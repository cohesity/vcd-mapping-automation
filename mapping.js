const program = require('commander');
const utility = require('./utility');

program
    .version('2.1.0')
    .requiredOption('-h, --href <href>', 'vcd endpoint href')
    .requiredOption('-u, --vcd-username <vcdUsername>', 'vcd provider username')
    .requiredOption('-p, --vcd-password <vcdPassword>', 'vcd provider password')
    .requiredOption('-v, --vcd-tenant <vcdTenantName>', 'vcd tenant name')
    .requiredOption('-e, --endpoint-name <endpointName>', 'endpoint configuration name')
    .requiredOption('-a, --action <action>', 'action (add|remove)')
    .requiredOption('--enc-password <password>', 'encryption password')
    .option('--cohesity-tenant <tenantName>', 'cohesity tenant name')
    .option('--cohesity-username <cohesityUserName>', 'cohesity username')
    .option('--cohesity-password <cohesityUserPassword>', 'cohesity password')
    .option('--cohesity-userDomain <cohesityUserDomain>', 'cohesity user domain');


program.parse(process.argv);
if (program.action === 'add') {
    if (!program.cohesityTenant || !program.cohesityUsername || !program.cohesityPassword || !program.cohesityUserDomain) {
        console.error('Error: Need to provide the cohesity tenant details.');
        process.exit(1);
    }
}

async function validateAndUpdateMappings() {
    const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
    /**
     * Await for the metadata to be updated successfully.
     */
    const awaitMetaUpdate = async function (attemptCount = 5) {
        if (attemptCount == 0) {
            throw new Error('Failed to update metadata. Maximum attempts reached.');
        }

        let uEpData = await utility.fetchEndpointData(token, program.href, systemOrgId, program.endpointName, sysOrgDEK);
        let uMappedTenants = uEpData.mappedTenants.map(mData => mData.vcdTenantName);
        if (program.action === 'add') {
            if (uMappedTenants.indexOf(program.vcdTenant) !== -1) { // new tenant has been added
                return true;
            }
        } else {
            if (uMappedTenants.indexOf(program.vcdTenant) === -1) { // vcd tenant removed
                return true;
            }
        }

        console.log('Metadata not updated yet. Awaiting update....');
        await timeout(2000);
        return await awaitMetaUpdate(attemptCount - 1);
    }

    // VCD Token
    const token = await utility.fetchAuthToken(program.vcdUsername, program.vcdPassword, program.href);

    // Fetch all the vCD Orgs.
    const allOrgs = await utility.fetchAllOrgIds(token, program.href);
    const allOrgNames = allOrgs.map(oData => oData.name);


    // From the System context fetch the endpoint data.
    const systemOrgId = allOrgs.filter(data => data.name.toLowerCase() === 'system')[0].id;
    console.debug(`System org id is ${systemOrgId}`);
    const sysOrgDEK = await utility.fetchOrgDEK(program.href, token, systemOrgId, program.encPassword);
    const epData = await utility.fetchEndpointData(token, program.href, systemOrgId, program.endpointName, sysOrgDEK);

    if (!epData) {
        throw new Error("Endpoint data not found.");
    }

    /**
     * Adding a new mapping information.
     */
    if (program.action === 'add') {
        // Fetch the Cohesity Cluster details
        const cohesityToken = await utility.getCohesityToken(
            epData.ip,
            epData.username,
            epData.password,
            epData.domain
        );
        const cohesityTenants = await utility.getAllCohesityTenants(epData.ip, cohesityToken);
        const allCohesityTenantNames = cohesityTenants.map(ctData => ctData.name);

        const csTenant = program.cohesityTenant;
        const vcdTenant = program.vcdTenant;

        // Ensure that the cohesity tenant exists.
        if (allCohesityTenantNames.indexOf(csTenant) === -1) {
            throw new Error("Invalid Cohesity tenant specified. Tenant does not exists.");
        }

        // Ensure that the vCD tenant exists.
        if (allOrgNames.indexOf(vcdTenant) === -1) {
            throw new Error("Invalid VCD tenant specified. Tenant does not exists.");
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
            cohesityUserName: program.cohesityUsername,
            cohesityPassword: program.cohesityPassword,
            cohesityDomain: program.cohesityUserDomain,
            isAutoGenerated: false
        };
        epData.mappedTenants.push(mappedTenantData);

        await utility.updateSystemMetaInfo(
            program.href,
            token,
            epData,
            sysOrgDEK,
            systemOrgId
        );
        console.log('Successfully added the mapping information to System Meta context.');


        // Add the endpoint in the tenant context
        // From the System context fetch the endpoint data.
        console.log('Adding mapping to tenant metadata context.');
        const vcdOrgId = allOrgs.filter(data => data.name.toLowerCase() === vcdTenant.toLowerCase())[0].id;
        let vcdOrgDEK = await utility.fetchOrgDEK(program.href, token, vcdOrgId, program.encPassword);

        if (!vcdOrgDEK) { // If the VCD org key is not defined, create a new org key.
            console.log('Generating new org KEK.');
            vcdOrgDEK = utility.generateRandomDEK();
            // Save the KEK in encrypted form.
            await utility.setEncryptionKeyInMetaEndpoint(program.href, token, vcdOrgDEK, `${vcdOrgId}@${program.encPassword}`, vcdOrgId);
        }

        const tenantEndpointData = {
            name: epData.name,
            ip: epData.ip,
            mappedTenants: mappedTenantData,
            version: epData.version
        };
        await utility.updateTenantMetaInfo(program.href, token, tenantEndpointData, vcdOrgDEK, vcdOrgId);
        console.log('Successfully added the mapping information to tenant context.')


        // Fetch the Settings metadata.
        console.log('Updating the settings metadata in the tenant context...');
        let settingsData;
        try {
            settingsData = await utility.fetchSettingsMetadata(program.href, token, systemOrgId, sysOrgDEK);
        } catch (err) {
            console.warn('Failed to fetch the settings metadata from system context', err);
        }

        if (settingsData) {
            try {
                await utility.saveSettingsMetadata(program.href, token, vcdOrgId, vcdOrgDEK, settingsData);
            } catch (err) {
                console.warn('Failed to update the settings metadata in tenant context.', err);
            }
        }
    }


    /**
     * When a mapping is removed.
     */
    if (program.action === 'remove') {
        const vcdTenant = program.vcdTenant

        // Ensure that the vcd tenant mapped to some cohesity tenant.
        if (epData.mappedTenants.filter(data => data.vcdTenantName === vcdTenant).length === 0) {
            throw new Error("NotAllowed. VCD Tenant specified is not mapped to any cohesity tenant.");
        }

        console.log(`Removing vcdTenant ${vcdTenant} from the endpoint.`);

        // Remove the tenant mapping and update the metadata (SYSTEM)
        epData.mappedTenants = epData.mappedTenants.filter(data => data.vcdTenantName !== vcdTenant);
        await utility.updateSystemMetaInfo(
            program.href,
            token,
            epData,
            sysOrgDEK,
            systemOrgId
        );
        console.log(`System metadata updated. vCD tenant mapping removed.`);


        // Remove the metadata for the tenant
        await utility.deleteTenantEndpointMeta(
            program.href,
            token,
            allOrgs.filter(data => data.name === vcdTenant)[0].id,
            epData.name
        );
        console.log(`Tenant endpoint deleted.`);
    }

    // Await the metadata to be updated.
    console.log(`Verifying if the metadata update is complete...`);
    await awaitMetaUpdate();

    // Publish extension to all the newly added endpoints.
    const extensionId = await utility.fetchExtensionId(program.href, token);
    const mappedTenants = await utility.fetchAllMappedVcdTenants(token, program.href, systemOrgId, sysOrgDEK);
    console.log('Newly mapped tenants', mappedTenants);

    if (extensionId) {
        // Unpublish the extension
        await utility.unpublishExtensionForAll(program.href, extensionId, token);

        // Publish the extension to tenants.
        await utility.publicExtensionToTenants(
            program.href,
            extensionId,
            token,
            allOrgs.filter(data => mappedTenants.indexOf(data.name) !== -1)
        );
    } else {
        console.error('Cohesity extension id not found.');
    }
}

validateAndUpdateMappings().catch(err => console.error(err));