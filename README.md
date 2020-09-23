
# Automation script

Use these automation scripts to perform command line operations to configure your vCloud extension with Cohesity. These could even be integrated in your development environment to automate the tenant mapping process in vCD.

## Prerequisites

* Node v10+ [Download](https://nodejs.org/en/download/)
* Cohesity vCD extension must be installed.

## Installation Steps
* Run `npm install` to install all the required dependencies.


## Supported Workflows
### 1. Add new tenant mapping to an endpoint configuration
To add a new VCD-Cohesity tenant mapping to an existing endpoint configuration, run

```
const mapper = require('cs-vcd-mapping');

m.mapTenants({
        href:               'https://vcd-host.com',
        vcdUsername:        '<provider-user>',
        vcdPassword:        '<provider-user-password>',
        endpointName:       '<endpoint-name>',
        csTenantName:       '<cohesity-tenant-name>',
        vcdTenantName:      '<vcd-tenant-name>',
        csUsername:         '<cohesity-tenant-user-id>',
        csUserPassword:     '<cohesity-tenant-user-password>',
        csUserDomain:       '<cohesity-tenant-user-domain>',
        encryptionPassword: '<encryption-password>'
    }).catch(err => {
        console.error(err);
    });

```


### 2. Remove a tenant mapping from an endpoint configuration
To remove an existing tenant mapping from an endpoint config, run

```
const mapper = require('cs-vcd-mapping');

mapper.unmapTenants({
        href:               'https://vcd-host.com',
        vcdUsername:        '<provider-user>',
        vcdPassword:        '<provider-user-password>',
        endpointName:       '<endpoint-name>',
        vcdTenantName:      '<vcd-tenant-name>',
        encryptionPassword: '<encryption-password>'
    }).catch(err => {
        console.error(err);
    });
```

### 3. Listing currently mapped tenants
To get the currently mapped tenants in an endpoint

```
const mapper = require('cs-vcd-mapping');

mapper.listMappingDetails({
    href:             'https://vcd-host.com',
    vcdUsername:      '<provider-user>',
    vcdPassword:      '<provider-user-password>',
    endpointName:     '<endpoint-name>',
    encryptionPassword: '<encryption-password>'
  }).then(list => {
      console.log(list);
  })
```

Request support for encryption password.

## Feedback
We love to hear from you. Please send your feedback and suggestions to cohesity-api-sdks@cohesity.com
