const axios = require('axios');
const uriBuilder = require('uribuilder');
const encryptor = require('./encrypt');
const https = require('https')

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
})
axios.defaults.httpsAgent = httpsAgent

/**
 * Await for given ms
 * @param {number} ms 
 */
const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {string} vcdHref 
 * @param {string} vcdApiToken 
 * @param {string} orgId 
 */
async function getOrgMetadata(vcdHref, vcdApiToken, orgId) {
    const builder = uriBuilder.UriBuilder.parse(vcdHref);
    builder.setPath(`/api/admin/org/${orgId}/metadata`);

    const options = {
        method: 'get',
        url: builder.toString(),
        headers: {
            'x-vcloud-authorization': vcdApiToken,
            Accept: 'application/*+json;version=34.0',
        }
    }

    const response = await axios(options);
    return response.data;
}

/**
 * 
 * @param {string} vcdHref 
 * @param {string} vcdApiToken 
 * @param {string} orgId 
 * @param {string} metaName 
 * @param {string} metaValue 
 */
async function saveMetadata(vcdHref, vcdApiToken, orgId, metaName, metaValue) {
    try {
        console.debug(`Saving metadata for org '${orgId}', metaName '${metaName}'...`);
        const data = `<Metadata xmlns="http://www.vmware.com/vcloud/v1.5"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          type="application/vnd.vmware.vcloud.metadata+xml">
          <MetadataEntry type="application/vnd.vmware.vcloud.metadata.value+xml">
            <Key>${metaName}</Key>
            <TypedValue xsi:type="MetadataStringValue">
                <Value>${metaValue}</Value>
            </TypedValue>
          </MetadataEntry>
        </Metadata>`;

        const builder = uriBuilder.UriBuilder.parse(vcdHref);
        builder.setPath(`/api/admin/org/${orgId}/metadata`);

        const options = {
            method: 'post',
            url: builder.toString(),
            headers: {
                'x-vcloud-authorization': vcdApiToken,
                Accept: 'application/*+json;version=34.0',
                'Content-Type': 'application/vnd.vmware.vcloud.metadata+xml'
            },
            data
        }

        const response = await axios(options);
        return response.data;
    } catch (err) {
        throw err;
    }
}



/**
 * Delete the endpoint data for the org.
 * @param {string} vcdHref 
 * @param {string} vcdApiToken 
 * @param {string} orgId 
 * @param {string} metaId 
 * @returns {Promise<void>}
 */
async function deleteEndpointForOrg(vcdHref, vcdApiToken, orgId, metaId) {
    try {
        console.debug(`Deleting endpoint data '${metaId}' for org '${orgId}'`);
        const builder = uriBuilder.UriBuilder.parse(vcdHref);
        builder.setPath(`/api/admin/org/${orgId}/metadata/${metaId}`);

        const options = {
            method: 'delete',
            url: builder.toString(),
            headers: {
                'x-vcloud-authorization': vcdApiToken,
                Accept: 'application/*+json;version=34.0',
                'Content-Type': 'application/vnd.vmware.vcloud.metadata+xml'
            }
        }

        const response = await axios(options);
        return response.data;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    fetchAuthToken: async function (username, password, href, org = "System") {
        try {
            console.debug('Fetching vcd auth token...');
            const builder = uriBuilder.UriBuilder.parse(href);
            builder.setPath('/api/sessions');

            var options = {
                method: 'post',
                url: builder.toString(),
                headers: {
                    'Authorization': `Basic ${Buffer.from(username + '@' + org + ':' + password).toString('base64')}`,
                    'Accept': 'application/*+xml;version=34.0'
                },
            };
            const response = await axios(options);
            return response.headers['x-vcloud-authorization'];
        } catch (err) {
            // Request fails.
            console.error("Auth Failure...");
            throw err;
        }
    },

    /**
     * Returns list of all orgIds
     * @param {string} vcdApiToken 
     * @param {string} vcdHref 
     * @returns {Promise<{name:string, id: string}[]>}
     */
    fetchAllOrgIds: async function (vcdApiToken, vcdHref) {
        try {
            console.debug('Fetching vCD organisations...');
            const builder = uriBuilder.UriBuilder.parse(vcdHref);
            builder.setPath('/api/org');

            const options = {
                method: 'get',
                url: builder.toString(),
                headers: {
                    'x-vcloud-authorization': vcdApiToken,
                    Accept: 'application/*+json;version=34.0',
                }
            }

            let orgMap = [];
            let response = await axios(options);
            response = response.data;
            for (const orgDetail of response.org) {
                const hrefParts = orgDetail.href.split('/');
                orgMap.push({
                    name: orgDetail.name,
                    id: hrefParts[hrefParts.length - 1]
                })
            }

            return orgMap;
        } catch (e) {
            console.error("failed to fetch all org ids...");
            throw e;
        }
    },

    /**
     * Fetch the endpoint config.
     * @param {string} vcdApiToken 
     * @param {string} vcdHref 
     * @param {string} orgId 
     * @param {string} endpointName 
     * @return {Promise<{
        name: string,
        ip: string,
        username: string,
        password: string,
        domain: string,
        mappedTenants: Array<{
            vcdTenantName: string,
            cohesityTenant: string, // cs tenant name
            cohesityTenantId: string,
            cohesityUserName: string,
            cohesityPassword: string,
            cohesityDomain: string,
            isAutoGenerated: boolean
        }>,
        version: number,
        email: string
        }>}
     */
    fetchEndpointData: async function (vcdApiToken, vcdHref, orgId, endpointName, decryptionPassword) {
        try {
            console.debug(`Fetching the endpoint metadata for org '${orgId}', endpointName '${endpointName}'...`);

            const response = await getOrgMetadata(vcdHref, vcdApiToken, orgId);
            for (const metaData of response.metadataEntry) {
                if (metaData.key === `cs_endpointConfig_${endpointName}`) {
                    return encryptor.decrypt(metaData.typedValue.value, decryptionPassword);
                }
            }
            return undefined;
        } catch (err) {
            console.error("Failed to fetch endpoint data..");
            throw err;
        }
    },

    /**
     * Returns all the vCD tenants mapped.
     * @param {string} vcdApiToken 
     * @param {string} vcdHref 
     * @param {string} systemOrgId 
     * @param {string} decryptionPassword 
     * @return {Promise<Array<string>>}
     */
    fetchAllMappedVcdTenants: async function (vcdApiToken, vcdHref, systemOrgId, decryptionPassword) {
        let mappedVcdTenants = [];
        try {
            const response = await getOrgMetadata(vcdHref, vcdApiToken, systemOrgId);
            for (const metaData of response.metadataEntry) {
                if (metaData.key.indexOf('cs_endpointConfig_') === 0) {
                    const epData = encryptor.decrypt(metaData.typedValue.value, decryptionPassword);
                    mappedVcdTenants = mappedVcdTenants.concat(epData.mappedTenants.map(data => data.vcdTenantName));
                }
            }
        } catch (err) {
            console.error("Failed to fetch endpoint data..");
            throw err;
        }
        return mappedVcdTenants;
    },

    /**
     * Returns the ORG's KEK
     * @param {string} vcdHref 
     * @param {string} vcdApiToken 
     * @param {string} orgId 
     * @param {string} password 
     * @return {Promise<sting>}
     */
    fetchOrgDEK: async function (vcdHref, vcdApiToken, orgId, encryptionPassword) {
        const metaData = await getOrgMetadata(vcdHref, vcdApiToken, orgId);
        let metaValue;
        metaData.metadataEntry.forEach(metadataEntry => {
            if (metadataEntry.key === "enc") {
                // Decrypt the key
                metaValue = encryptor.decrypt(
                    metadataEntry.typedValue['value'],
                    `${orgId}@${encryptionPassword}`
                );
            }
        });

        return metaValue;
    },

    /**
     * Returns the settings metadata information.
     * @param {string} vcdHref 
     * @param {string} vcdApiToken 
     * @param {string} orgId 
     * @param {string} decryptionPassword 
     */
    fetchSettingsMetadata: async function (vcdHref, vcdApiToken, orgId, decryptionPassword) {
        const metaData = await getOrgMetadata(vcdHref, vcdApiToken, orgId);
        let metaValue;
        metaData.metadataEntry.forEach(metadataEntry => {
            if (metadataEntry.key === "COHESITY_SETTINGS") {
                // Decrypt the key
                metaValue = encryptor.decrypt(
                    metadataEntry.typedValue['value'],
                    decryptionPassword
                );
            }
        });

        return metaValue;
    },

    /**
     * Returns the settings metadata information.
     * @param {string} vcdHref 
     * @param {string} vcdApiToken 
     * @param {string} orgId 
     * @param {string} dek - Data encryption key
     * @param {string} settingsObj 
     */
    saveSettingsMetadata: async function (vcdHref, vcdApiToken, orgId, dek, settingsObj) {
        const metaName = `COHESITY_SETTINGS`;
        // Encrypted payload.
        const metaValue = encryptor.encrypt(settingsObj, dek);

        await saveMetadata(vcdHref, vcdApiToken, orgId, metaName, metaValue);
    },


    /**
     * Get the cohesity token for the endpoint.
     * @param {string} fqdn 
     * @param {string} username 
     * @param {string} password 
     * @param {string} domain 
     * @returns {Promise<string>}
     */
    getCohesityToken: async function (fqdn, username, password, domain) {
        try {
            console.debug('Validation cohesity credentials...');
            const builder = new uriBuilder.UriBuilder();
            builder.host = fqdn;
            builder.schema = "https";
            builder.setPath('/irisservices/api/v1/public/accessTokens');

            const options = {
                method: 'post',
                url: builder.toString(),
                data: {
                    username,
                    password,
                    domain
                },
                headers: {
                    'Content-Type': `application/json`
                }
            }

            let response = await axios(options);
            response = response.data;
            return `Bearer ${response.accessToken}`;
        } catch (err) {
            console.error("Failed to fetch the cohesity access token..");
            throw err;
        }
    },

    /**
     * Fetch all the cohesity tenants.
     * @param {string} fqdn 
     * @param {string} csAccessToken 
     * @returns {Promise<{name:string, tenantId:string}[]>}
     */
    getAllCohesityTenants: async function (fqdn, csAccessToken) {
        try {
            console.debug('Fetching all cohesity tenants...');
            const builder = new uriBuilder.UriBuilder();
            builder.host = fqdn;
            builder.schema = "https";
            builder.setPath('/irisservices/api/v1/public/tenants?status=Active');
            const options = {
                method: 'get',
                url: builder.toString(),
                headers: {
                    'Authorization': csAccessToken,
                    'Content-Type': `application/json`
                }
            }

            let response = await axios(options);
            response = response.data;

            return response.map(rData => ({
                name: rData.name,
                tenantId: rData.tenantId
            }));
        } catch (err) {
            console.error("Failed to fetch cohesity tenants..");
            throw err;
        }
    },

    /**
     * Builds and update the meta information
     */
    updateSystemMetaInfo: async function (vcdHref, vcdApiToken, endpointData, encryptionPassword, orgId) {
        const metaName = `cs_endpointConfig_${endpointData.name}`;
        // Encrypted payload.
        const metaValue = encryptor.encrypt(endpointData, encryptionPassword);

        await saveMetadata(vcdHref, vcdApiToken, orgId, metaName, metaValue);
    },

    /**
     * Builds and update the tenant information
     */
    updateTenantMetaInfo: async function (vcdHref, vcdApiToken, endpointData, encryptionPassword, orgId) {
        const metaName = `cs_tenantConfig_${endpointData.name}`;
        // Encrypted payload.
        const metaValue = encryptor.encrypt(endpointData, encryptionPassword);

        await saveMetadata(vcdHref, vcdApiToken, orgId, metaName, metaValue);
    },

    /**
     * 
     * @param {string} vcdHref 
     * @param {string} vcdApiToken 
     * @param {string} orgId 
     * @param {string} endpointName 
     */
    deleteTenantEndpointMeta: async function (vcdHref, vcdApiToken, orgId, endpointName) {
        await deleteEndpointForOrg(vcdHref, vcdApiToken, orgId, `cs_tenantConfig_${endpointName}`);
    },

    /**
     * Generates a random DATA-encryption-key
     * @param {string} encPassword 
     */
    generateRandomDEK: function (encPassword) {
        return encryptor.randomKey();
    },

    /**
     * @param {string} vcdHref 
     * @param {string} vcdApiToken 
     * @param {string} orgDEK 
     * @param {string} orgKEK 
     * @param {string} orgId 
     */
    setEncryptionKeyInMetaEndpoint: async function (vcdHref, vcdApiToken, orgDEK, orgKEK, orgId) {
        await saveMetadata(vcdHref, vcdApiToken, orgId, "enc", encryptor.encrypt(orgDEK, orgKEK));
    },

    /**
     * Unpublish the extension for all.
     * @param {string} vcdHref 
     * @param {string} extensionId 
     * @param {string} vcdApiToken 
     */
    unpublishExtensionForAll: async function (vcdHref, extensionId, vcdApiToken) {
        console.log('Unpublishing extension...');
        const builder = uriBuilder.UriBuilder.parse(vcdHref);
        builder.setPath(`/cloudapi/extensions/ui/${extensionId}/tenants/unpublishAll`);

        const options = {
            method: 'post',
            url: builder.toString(),
            headers: {
                'x-vcloud-authorization': vcdApiToken,
                Accept: 'application/json;version=34.0',
                'Content-Type': 'application/json'
            }
        }

        const response = await axios(options);
        return response.data;
    },

    /**
     * Publish extension to vcd tenants.
     * @param {string} vcdHref 
     * @param {string} extensionId 
     * @param {string} vcdApiToken 
     * @param {Array<{name: string, id: string}>} tenantData 
     */
    publicExtensionToTenants: async function (vcdHref, extensionId, vcdApiToken, tenantData) {
        console.log('Publishing extension to tenants', tenantData.map(data => data.name));
        const builder = uriBuilder.UriBuilder.parse(vcdHref);
        builder.setPath(`/cloudapi/extensions/ui/${extensionId}/tenants/publish`);

        const options = {
            method: 'post',
            data: tenantData,
            url: builder.toString(),
            headers: {
                'x-vcloud-authorization': vcdApiToken,
                Accept: 'application/json;version=34.0',
                'Content-Type': 'application/json'
            }
        }

        const response = await axios(options);
        return response.data;
    },

    /**
     * Returns the extension id of Cohesity plugin.
     * @param {string} vcdHref 
     * @param {string} vcdApiToken 
     */
    fetchExtensionId: async function (vcdHref, vcdApiToken) {
        const builder = uriBuilder.UriBuilder.parse(vcdHref);
        builder.setPath(`/cloudapi/extensions/ui`);

        const options = {
            method: 'get',
            url: builder.toString(),
            headers: {
                'x-vcloud-authorization': vcdApiToken,
                Accept: 'application/json;version=34.0',
                'Content-Type': 'application/json'
            }
        };


        let extensions = await axios(options);
        extensions = extensions.data;
        for (const ext of extensions) {
            if (ext.pluginName === 'Cohesity') {
                return ext.id;
            }
        }
    },

    /**
     * Await for the metadata to be updated successfully.
     */
    awaitMetaUpdate: async function (vcdHref, vcdProviderToken, sysOrgId, sysOrgDEK, epName, vcdTenantName, action, attemptCount = 5) {
        if (attemptCount == 0) {
            throw new Error('Failed to update metadata. Maximum attempts reached.');
        }

        let uEpData = await this.fetchEndpointData(vcdProviderToken, vcdHref, sysOrgId, epName, sysOrgDEK);
        let uMappedTenants = uEpData.mappedTenants.map(mData => mData.vcdTenantName);
        if (action === 'add') {
            // new tenant has been added
            if (uMappedTenants.indexOf(vcdTenantName) !== -1) {
                return true;
            }
        } else {
            // vcd tenant removed
            if (uMappedTenants.indexOf(vcdTenantName) === -1) {
                return true;
            }
        }

        // console.log('Metadata not updated yet. Awaiting update....');
        await timeout(2000);
        return await awaitMetaUpdate(vcdHref, vcdProviderToken, sysOrgId, sysOrgDEK, epName, attemptCount - 1);
    }
}