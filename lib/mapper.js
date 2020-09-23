const utility = require('./utility');

/**
 * Publish extension to all the newly mapped tenants.
 * @param {string} vcdHref 
 * @param {string} vcdProviderToken 
 * @param {string} systemOrgId 
 * @param {string} sysOrgDEK 
 * @param {*} allOrgs 
 */
async function publishExtension(vcdHref, vcdProviderToken, systemOrgId, sysOrgDEK, allOrgs) {
    // Publish extension to all the newly added endpoints.
    const extensionId = await utility.fetchExtensionId(vcdHref, vcdProviderToken);
    const mappedTenants = await utility.fetchAllMappedVcdTenants(vcdProviderToken, vcdHref, systemOrgId, sysOrgDEK);

    if (extensionId) {
        // Unpublish the extension
        await utility.unpublishExtensionForAll(vcdHref, extensionId, vcdProviderToken);

        // Publish the extension to tenants.
        await utility.publicExtensionToTenants(
            vcdHref,
            extensionId,
            vcdProviderToken,
            allOrgs.filter(data => mappedTenants.indexOf(data.name) !== -1)
        );
    } else {
        console.error('Cohesity extension id not found.');
    }
}

/**
 * Update the SETTINGS meta data for the vCD tenant.
 * @param {string} vcdHref 
 * @param {string} vcdProviderToken 
 * @param {string} systemOrgId 
 * @param {string} sysOrgDEK 
 * @param {string} vcdOrgId 
 * @param {string} vcdOrgDEK 
 */
async function updateSettingsMeta(vcdHref, vcdProviderToken, systemOrgId, sysOrgDEK, vcdOrgId, vcdOrgDEK) {
    let settingsData;
    try {
        settingsData = await utility.fetchSettingsMetadata(vcdHref, vcdProviderToken, systemOrgId, sysOrgDEK);
    } catch (err) {
        console.warn('Failed to fetch the settings metadata from system context', err);
    }

    if (settingsData) {
        try {
            await utility.saveSettingsMetadata(vcdHref, vcdProviderToken, vcdOrgId, vcdOrgDEK, settingsData);
        } catch (err) {
            console.warn('Failed to update the settings metadata in tenant context.', err);
        }
    }
}

module.exports = {
    /**
     * @param {Object} requestParams description
     * @param {href} requestParams.href vCD href ex. 'https://vcd-host.com'
     * @param {vcdUsername} requestParams.vcdUsername vCD provider username
     * @param {vcdPassword} requestParams.vcdPassword vCD provider password
     * @param {endpointName} requestParams.endpointName Endpoint name
     * @param {vcdTenantName} requestParams.vcdTenantName Newly mapped vCD tenant name
     * @param {csTenantName} requestParams.csTenantName Newly mapped Cohesity tenant name
     * @param {csUsername} requestParams.csUsername Mapped username
     * @param {csUserPassword} requestParams.csUserPassword Mapped user password
     * @param {csUserDomain} requestParams.csUserDomain Mapped user domain
     * @param {encryptionPassword} requestParams.encryptionPassword Encryption password
     * @returns {Promise<void>}
     */
    mapTenants: async function (requestParams) {
        // VCD Token
        const vcdProviderToken = await utility.fetchAuthToken(requestParams.vcdUsername, requestParams.vcdPassword, requestParams.href);

        // Fetch all the vCD Orgs.
        const allOrgs = await utility.fetchAllOrgIds(vcdProviderToken, requestParams.href);
        const allOrgNames = allOrgs.map(oData => oData.name);


        // From the System context fetch the endpoint data.
        const systemOrgId = allOrgs.filter(data => data.name.toLowerCase() === 'system')[0].id;

        // SYSTEM Data encryption key
        const sysOrgDEK = await utility.fetchOrgDEK(requestParams.href, vcdProviderToken, systemOrgId, requestParams.encryptionPassword);
        const epData = await utility.fetchEndpointData(vcdProviderToken, requestParams.href, systemOrgId, requestParams.endpointName, sysOrgDEK);

        if (!epData) {
            throw new Error("Endpoint data not found. Please check the endpoint name.");
        }

        // Fetch the Cohesity Cluster details
        const cohesityToken = await utility.getCohesityToken(
            epData.ip,
            epData.username,
            epData.password,
            epData.domain
        );

        const cohesityTenants = await utility.getAllCohesityTenants(epData.ip, cohesityToken);
        const allCohesityTenantNames = cohesityTenants.map(ctData => ctData.name);

        const csTenant = requestParams.csTenantName;
        const vcdTenant = requestParams.vcdTenantName;

        // Ensure that the cohesity tenant exists.
        if (allCohesityTenantNames.indexOf(csTenant) === -1) {
            throw new Error("Invalid Cohesity tenant specified. Tenant does not exists.");
        }

        // Ensure that the vCD tenant exists.
        if (allOrgNames.indexOf(vcdTenant) === -1) {
            throw new Error("Invalid vCD tenant specified. Tenant does not exists.");
        }

        // Ensure that the vcd tenant is not already mapped.
        if (epData.mappedTenants.filter(data => data.vcdTenantName === vcdTenant).length > 0) {
            throw new Error("NotAllowed. VCD Tenant is already mapped to some cohesity tenant.");
        }

        // Ensure that the cohesity tenant is not already mapped.
        if (epData.mappedTenants.filter(data => data.cohesityTenant === csTenant).length > 0) {
            throw new Error("NotAllowed. Cohesity Tenant is already mapped to some vcd tenant.");
        }

        // Add the new tenant details in the SYSTEM metadata context
        console.log('Adding mapping to system metadata context.');
        const mappedTenantData = {
            vcdTenantName: vcdTenant,
            cohesityTenant: csTenant,
            cohesityTenantId: cohesityTenants.filter(data => data.name === csTenant)[0].tenantId,
            cohesityUserName: requestParams.csUsername,
            cohesityPassword: requestParams.csUserPassword,
            cohesityDomain: requestParams.csUserDomain,
            isAutoGenerated: false
        };
        epData.mappedTenants.push(mappedTenantData);

        // Update the system endpoint.
        await utility.updateSystemMetaInfo(
            requestParams.href,
            vcdProviderToken,
            epData,
            sysOrgDEK,
            systemOrgId
        );
        // console.log('Successfully added the mapping information to System Meta context.');

        // Add the endpoint in the tenant context
        const vcdOrgId = allOrgs.filter(data => data.name.toLowerCase() === vcdTenant.toLowerCase())[0].id;
        let vcdOrgDEK = await utility.fetchOrgDEK(requestParams.href, vcdProviderToken, vcdOrgId, requestParams.encryptionPassword);

        if (!vcdOrgDEK) { // If the VCD org key is not defined, create a new org key.
            vcdOrgDEK = utility.generateRandomDEK();

            // Save the KEK in encrypted form.
            await utility.setEncryptionKeyInMetaEndpoint(requestParams.href, vcdProviderToken, vcdOrgDEK, `${vcdOrgId}@${requestParams.encryptionPassword}`, vcdOrgId);
        }

        const tenantEndpointData = {
            name: epData.name,
            ip: epData.ip,
            mappedTenants: mappedTenantData,
            version: epData.version
        };
        await utility.updateTenantMetaInfo(requestParams.href, vcdProviderToken, tenantEndpointData, vcdOrgDEK, vcdOrgId);

        // Fetch the Settings metadata.
        await updateSettingsMeta(requestParams.href, vcdProviderToken, systemOrgId, sysOrgDEK, vcdOrgId, vcdOrgDEK);

        // Await the metadata update
        await utility.awaitMetaUpdate(
            requestParams.href,
            vcdProviderToken,
            systemOrgId,
            sysOrgDEK,
            requestParams.endpointName,
            requestParams.vcdTenantName,
            'add'
        );

        // Publish the extension
        await publishExtension(requestParams.href, vcdProviderToken, systemOrgId, sysOrgDEK, allOrgs);
    },

    /**
     * @param {Object} requestParams description
     * @param {href} requestParams.href vCD href ex. 'https://vcd-host.com'
     * @param {vcdUsername} requestParams.vcdUsername vCD provider username
     * @param {vcdPassword} requestParams.vcdPassword vCD provider password
     * @param {endpointName} requestParams.endpointName Endpoint name
     * @param {vcdTenantName} requestParams.vcdTenantName Newly mapped vCD tenant name
     * @param {encryptionPassword} requestParams.encryptionPassword Encryption password
     * @returns {Promise<void>}
     */
    unmapTenants: async function (requestParams) {
        // VCD Token
        const vcdProviderToken = await utility.fetchAuthToken(requestParams.vcdUsername, requestParams.vcdPassword, requestParams.href);

        // Fetch all the vCD Orgs.
        const allOrgs = await utility.fetchAllOrgIds(vcdProviderToken, requestParams.href);

        // From the System context fetch the endpoint data.
        const systemOrgId = allOrgs.filter(data => data.name.toLowerCase() === 'system')[0].id;

        // SYSTEM Data encryption key
        const sysOrgDEK = await utility.fetchOrgDEK(requestParams.href, vcdProviderToken, systemOrgId, requestParams.encryptionPassword);
        const epData = await utility.fetchEndpointData(vcdProviderToken, requestParams.href, systemOrgId, requestParams.endpointName, sysOrgDEK);

        if (!epData) {
            throw new Error("Endpoint data not found. Please check the endpoint name.");
        }

        // The vCD tenant name which is to be removed.
        const vcdTenant = requestParams.vcdTenantName

        // Ensure that the vcd tenant mapped to some cohesity tenant.
        if (epData.mappedTenants.filter(data => data.vcdTenantName === vcdTenant).length === 0) {
            throw new Error("NotAllowed. VCD Tenant specified is not mapped to any cohesity tenant.");
        }

        // Remove the tenant mapping and update the metadata (SYSTEM)
        epData.mappedTenants = epData.mappedTenants.filter(data => data.vcdTenantName !== vcdTenant);
        await utility.updateSystemMetaInfo(
            requestParams.href,
            vcdProviderToken,
            epData,
            sysOrgDEK,
            systemOrgId
        );
        console.log(`System metadata updated. vCD tenant mapping removed.`);

        // Remove the metadata for the tenant
        await utility.deleteTenantEndpointMeta(
            requestParams.href,
            vcdProviderToken,
            allOrgs.filter(data => data.name === vcdTenant)[0].id,
            epData.name
        );

        // Await the metadata update
        await utility.awaitMetaUpdate(
            requestParams.href,
            vcdProviderToken,
            systemOrgId,
            sysOrgDEK,
            requestParams.endpointName,
            requestParams.vcdTenantName,
            'remove'
        );

        // Publish the extension
        await publishExtension(
            requestParams.href,
            vcdProviderToken,
            systemOrgId,
            sysOrgDEK,
            allOrgs
        );
    },

    /**
     * @param {Object} requestParams description
     * @param {href} requestParams.href vCD href ex. 'https://vcd-host.com'
     * @param {vcdUsername} requestParams.vcdUsername vCD provider username
     * @param {vcdPassword} requestParams.vcdPassword vCD provider password
     * @param {endpointName} requestParams.endpointName Endpoint name
     * @param {encryptionPassword} requestParams.encryptionPassword Encryption password
     * @returns {Promise<Array<{vcdTenant: string, cohesityTenant: string}>>}
     */
    listMappingDetails: async function (requestParams) {
        // VCD Token
        const vcdProviderToken = await utility.fetchAuthToken(requestParams.vcdUsername, requestParams.vcdPassword, requestParams.href);

        // Fetch all the vCD Orgs.
        const allOrgs = await utility.fetchAllOrgIds(vcdProviderToken, requestParams.href);

        // From the System context fetch the endpoint data.
        const systemOrgId = allOrgs.filter(data => data.name.toLowerCase() === 'system')[0].id;

        // SYSTEM Data encryption key
        const sysOrgDEK = await utility.fetchOrgDEK(requestParams.href, vcdProviderToken, systemOrgId, requestParams.encryptionPassword);
        const epData = await utility.fetchEndpointData(vcdProviderToken, requestParams.href, systemOrgId, requestParams.endpointName, sysOrgDEK);

        if (!epData) {
            throw new Error("Endpoint data not found. Please check the endpoint name.");
        }

        return epData.mappedTenants.map(d => ({
            vcdTenant: d.vcdTenantName,
            cohesityTenant: d.cohesityTenant
        }));
    }
}