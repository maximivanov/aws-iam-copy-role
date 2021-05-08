const AWS = require("aws-sdk")
let iam

;(async () => {
    try {
        const [sourceRoleName, targetRoleName] = loadArguments()

        checkAwsCredentials()

        const sourceRole = await fetchRole(sourceRoleName)
        const inlinePolicies = await fetchInlinePolicies(sourceRoleName)
        const managedPolicies = await fetchManagedPolicies(sourceRoleName)
        
        await createRoleFromExisting(sourceRole, targetRoleName)
        
        if (inlinePolicies.length > 0) {
            await addInlinePolicies(targetRoleName, inlinePolicies)
        }

        if (managedPolicies.length > 0) {
            await addManagedPolicies(targetRoleName, managedPolicies)
        }

        log('\nDone!')
    } catch (e) {
        error(e.message)
    }
})()

function loadArguments() {
    log('\n--> Parsing arguments from command line...')
    
    const cmdArgs = process.argv.slice(2)
    if (cmdArgs.length !== 2) {
        throw new TypeError("<-- Usage: node copy-role.js SOURCE_ROLE_NAME TARGET_ROLE_NAME")
    }

    log(`<-- Arguments loaded. Source role name: ${cmdArgs[0]}, target role name: ${cmdArgs[1]}`)

    return cmdArgs
}

function checkAwsCredentials() {
    log('\n--> Checking if AWS credentials are loaded...')
    
    if (!AWS.config.credentials) {
        throw new Error(`<-- Failed to find AWS credentials. Consider providing them with environment variables.`)
    }

    log('<-- AWS credentials found.')
}

async function fetchRole(roleName) {
    log('\n--> Fetching source role...')

    let role
    try {
        role = (await getIam().getRole({RoleName: roleName}).promise()).Role
    } catch (e) {
        throw new Error(`<-- Failed to fetch source role: "${e.message}"`)
    }

    log('<-- Source role loaded.')

    return role
}

async function fetchInlinePolicies(roleName) {
    log(`\n--> Fetching inline policy names for ${roleName}...`)

    let inlinePolicyNames
    try {
        inlinePolicyNames = await fetchInlinePoliciesRecursive()
    } catch (e) {
        throw new Error(`<-- Failed to fetch inline policy names: "${e.message}"`)
    }

    log(`<-- Loaded ${inlinePolicyNames.length} inline policy names.`)

    if (inlinePolicyNames.length === 0) {
        return []
    }

    log('--> Fetching inline policies...')

    let inlinePolies = []

    try {
        for (const inlinePolicyName of inlinePolicyNames) {
            inlinePolies.push(await getIam().getRolePolicy({RoleName: roleName, PolicyName: inlinePolicyName}).promise())
        }
    } catch (e) {
        throw new Error(`<-- Failed to fetch inline policy: "${e.message}"`)
    }

    log(`<-- Loaded inline policies.`)

    return inlinePolies

    async function fetchInlinePoliciesRecursive(marker) {
        let inlinePolicyNames
        
        const response = await getIam().listRolePolicies({RoleName: roleName, Marker: marker}).promise()
        inlinePolicyNames = response.PolicyNames

        if (response.IsTruncated) {
            inlinePolicyNames = inlinePolicyNames.concat(await fetchInlinePoliciesRecursive(response.Marker))
        }

        return inlinePolicyNames
    }
}

async function fetchManagedPolicies(roleName) {
    log(`\n--> Fetching managed policies for ${roleName}...`)

    let managedPolicies
    try {
        managedPolicies = await fetchManagedPoliciesRecursive()
    } catch (e) {
        throw new Error(`<-- Failed to fetch managed policies: "${e.message}"`)
    }

    log(`<-- Loaded ${managedPolicies.length} managed policies.`)

    return managedPolicies

    async function fetchManagedPoliciesRecursive(marker) {
        let managedPolicies
        
        const response = await getIam().listAttachedRolePolicies({RoleName: roleName, Marker: marker}).promise()
        managedPolicies = response.AttachedPolicies

        if (response.IsTruncated) {
            managedPolicies = managedPolicies.concat(await fetchInlinePoliciesRecursive(response.Marker))
        }

        return managedPolicies
    }
}

async function createRoleFromExisting(sourceRole, targetRoleName) {
    log(`\n--> Creating a new role ${targetRoleName}...`)

    let targetRole
    try {
        targetRole = (await getIam().createRole({
            Path: sourceRole.Path,
            RoleName: targetRoleName,
            AssumeRolePolicyDocument: decodeURIComponent(sourceRole.AssumeRolePolicyDocument),
            Description: sourceRole.Description,
            MaxSessionDuration: sourceRole.MaxSessionDuration,
            PermissionsBoundary: sourceRole.PermissionsBoundary ? sourceRole.PermissionsBoundary.PermissionsBoundaryArn: undefined,
            Tags: sourceRole.Tags,
        }).promise()).Role
    } catch (e) {
        throw new Error(`<-- Failed to create target role: "${e.message}"`)
    }

    log(`<-- Created role ${targetRoleName}.`)

    return targetRole
}

async function addInlinePolicies(targetRoleName, policies) {
    log(`\n--> Adding inline policies to ${targetRoleName}...`)

    try {
        for (const policy of policies) {
            await getIam().putRolePolicy({
                RoleName: targetRoleName,
                PolicyName: policy.PolicyName,
                PolicyDocument: decodeURIComponent(policy.PolicyDocument),
            }).promise()
        }
    } catch (e) {
        throw new Error(`<-- Failed to add inline policies: "${e.message}"`)
    }

    log(`<-- Added ${policies.length} inline policies.`)
}

async function addManagedPolicies(targetRoleName, policies) {
    log(`\n--> Adding managed policies to ${targetRoleName}...`)

    try {
        for (const policy of policies) {
            await getIam().attachRolePolicy({
                RoleName: targetRoleName,
                PolicyArn: policy.PolicyArn,
            }).promise()
        }
    } catch (e) {
        throw new Error(`<-- Failed to add managed policies: "${e.message}"`)
    }

    log(`<-- Added ${policies.length} managed policies.`)
}

function getIam() {
    if (!iam) {
        iam = new AWS.IAM()
    }

    return iam
}

function log(message) {
    console.log(message)
}

function error(message) {
    console.log(`                                          
              ████████████                                                        
            ████  ██████████                                                      
            ████████████████                                                      
            ████████                                                    ████      
            ████████████                                                ████      
██        ████████                                                      ████      
████    ██████████████                                ████        ████  ████  ████
██████████████████  ██                                ████  ██    ████  ████  ████
██████████████████                                    ████  ██    ████  ████  ████
  ████████████████                                ██  ████  ██    ████  ████  ████
    ████████████                                  ██  ████████    ████████████████
      ████████                                    ██  ████          ████████████  
      ████  ██                                    ████████              ████      
      ██    ██      ████          ████                ████              ████      
      ████  ████  ██    ██      ██    ██              ████              ████      
  ████████████████        ██████        ████████████  ████  ██████████  ████  ████
                    ████          ████                ████              ████      
    ████                    ████        ████                ████  ████            
                ████                            ████                          ████
`)
    console.error(message)
    process.exitCode = 1
}