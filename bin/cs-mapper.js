const { action } = require('commander');
const program = require('commander');
const mapper = require('./../lib/mapper');

program
    .version('2.2.1')
    .requiredOption('-h, --href <href>', 'vcd endpoint href')
    .requiredOption('-u, --vcd-username <vcdUsername>', 'vcd provider username')
    .requiredOption('-p, --vcd-password <vcdPassword>', 'vcd provider password')
    .requiredOption('-e, --endpoint-name <endpointName>', 'endpoint configuration name')
    .requiredOption('-a, --action <action>', 'action (add|remove|list)')
    .requiredOption('-w, --enc-password <password>', 'encryption password')
    .option('-v, --vcd-tenant <vcdTenantName>', 'vcd tenant name')
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

    // Add the tenant mapping
    mapper.mapTenants({
        href: program.href,
        vcdUsername: program.vcdUsername,
        vcdPassword: program.vcdPassword,
        endpointName: program.endpointName,
        vcdTenantName: program.vcdTenantName,
        csTenantName: program.tenantName,
        csUsername: program.cohesityUserName,
        csUserPassword: program.cohesityUserPassword,
        csUserDomain: program.cohesityUserDomain,
        encryptionPassword: program.encPassword
    }).catch(err => {
        console.error('Failed to add tenant mapping information', err);
    })
} else if (program.action === "list") {
    // Add the tenant mapping
    mapper.listMappingDetails({
        href: program.href,
        vcdUsername: program.vcdUsername,
        vcdPassword: program.vcdPassword,
        endpointName: program.endpointName,
        encryptionPassword: program.encPassword
    }).then(data => {
        console.log(data);
    }).catch(err => {
        console.error('Failed to list tenant mapping information', err);
    })
} else {
    // Remove the tenant mapping
    mapper.unmapTenants({
        href: program.href,
        vcdUsername: program.vcdUsername,
        vcdPassword: program.vcdPassword,
        endpointName: program.endpointName,
        vcdTenantName: program.vcdTenantName,
        encryptionPassword: program.encPassword
    }).catch(err => {
        console.error('Failed to remove tenant mapping', err);
    })
}