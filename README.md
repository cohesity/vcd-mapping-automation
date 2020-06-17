
# Automation script

Use these automation scripts to perform command line operations to configure your vCloud extension with Cohesity. These could even be integrated in your development environment to automate the tenant mapping process in vCD.

## Prerequisites

* Node v10+ [Download](https://nodejs.org/en/download/)
* Cohesity vCD extension must be installed.

## Installation Steps
* Run `npm install` to install all the required dependencies.

## Supported Options
`node mapping.js --help`
```
Options:
  -V, --version                               output the version number
  -h, --href <href>                           vcd endpoint href
  -u, --vcd-username <vcdUsername>            vcd provider username
  -p, --vcd-password <vcdPassword>            vcd provider password
  -v, --vcd-tenant <vcdTenantName>            vcd tenant name
  -e, --endpoint-name <endpointName>          endpoint configuration name
  -a, --action <action>                       action (add|remove)
  --enc-password <password>                   encryption password
  --cohesity-tenant <tenantName>              cohesity tenant name
  --cohesity-username <cohesityUserName>      cohesity username
  --cohesity-password <cohesityUserPassword>  cohesity password
  --cohesity-userDomain <cohesityUserDomain>  cohesity user domain
  -h, --help                                  output usage information
```

## Supported Workflows
### 1. Add new tenant mapping to an endpoint configuration
To add a new VCD-Cohesity tenant mapping to an existing endpoint configuration, run

```
node mapping.js 
  -a add
  -u administrator
  -p password
  -h https://vcd-server-instance
  -e 'endpoint-name'
  -v 'vcd-tenant-name'
  --enc-password '<encrpytion-password>'
  --cohesity-tenant 'cohesity-org-001' 
  --cohesity-username 'org-001-user' 
  --cohesity-password 'org-001-user-password' 
  --cohesity-userDomain 'LOCAL' 
  
```


### 2. Remove a tenant mapping from an endpoint configuration
To remove an existing tenant mapping from an endpoint config, run

```
node mapping.js 
  -a remove
  -u administrator 
  -p password 
  -h https://vcd-server-instance 
  -e 'endpoint-name'  
  -v 'testOrg'
  --enc-password '<encryption-password>' 
```

Request support for encryption password.

## Feedback
We love to hear from you. Please send your feedback and suggestions to cohesity-api-sdks@cohesity.com
