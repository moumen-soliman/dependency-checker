#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const semver = require('semver');
const { format } = require('date-fns');

// Fetch package info from npm
async function getLastVersionInfo(packageName) {
    const url = `https://registry.npmjs.org/${packageName}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const latestVersion = data['dist-tags']?.latest;
        const latestVersionDate = latestVersion ? data.time[latestVersion] : null;

        if (!latestVersion) {
            console.warn(chalk.yellow(`No 'latest' version found for package: ${packageName}`));
        }

        return { packageName, latestVersion, latestVersionDate, allVersions: Object.keys(data.versions) };
    } catch (error) {
        console.error(chalk.red(`Failed to fetch data for ${packageName}: ${error.message}`));
        return { packageName, latestVersion: null, latestVersionDate: null, allVersions: [] };
    }
}

// Flatten nested dependencies
function flattenDependencies(dependencies, prefix = '') {
    const flattened = {};
    for (const [key, value] of Object.entries(dependencies)) {
        if (typeof value === 'string') {
            flattened[`${prefix}${key}`] = value;
        } else if (typeof value === 'object' && value !== null) {
            Object.assign(flattened, flattenDependencies(value, `${key}/`));
        }
    }
    return flattened;
}

// Determine the type of upgrade
function checkUpgradeType(installedVersion, latestVersion) {
    if (!installedVersion || installedVersion === 'unknown' || !latestVersion) {
        return 'unknown';
    }

    if (semver.eq(installedVersion, latestVersion)) {
        return 'none';
    } else if (semver.major(latestVersion) > semver.major(installedVersion)) {
        return 'major';
    } else if (semver.minor(latestVersion) > semver.minor(installedVersion)) {
        return 'minor';
    } else if (semver.patch(latestVersion) > semver.patch(installedVersion)) {
        return 'patch';
    }

    return 'none';
}

// Determine if the package will self-upgrade
function willSelfUpgrade(currentVersionRange, highestSatisfyingVersion, installedVersion, latestVersion) {
    if (
        !highestSatisfyingVersion ||
        !currentVersionRange ||
        installedVersion === 'unknown' ||
        !latestVersion
    ) {
        return false;
    }

    const satisfiesRange = semver.satisfies(highestSatisfyingVersion, currentVersionRange);
    const needsUpgrade = semver.gt(highestSatisfyingVersion, installedVersion);

    return satisfiesRange && needsUpgrade;
}

// Get installed version
function getInstalledVersion(packageName, installedDependencies) {
    if (installedDependencies[packageName]?.version) {
        return installedDependencies[packageName].version;
    }

    try {
        const packageJsonPath = path.join('node_modules', packageName, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version;
    } catch {
        return 'unknown';
    }
}

// Parse Yarn lock file
function parseYarnLock(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const dependencies = {};

    const regex = /"(.+?)@(.+?)":\n  version "(.+?)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const [, packageName, versionRange, version] = match;
        dependencies[packageName] = { versionRange, version };
    }

    return dependencies;
}

// Display key descriptions
function displayDescriptions() {
    console.log(chalk.bold.green('\nKey Descriptions:'));
    console.log(chalk.cyan('  Current Version Range      : The version range specified in package.json.'));
    console.log(chalk.cyan('  Highest Satisfying Version : The highest version that satisfies the current range in package.json.'));
    console.log(chalk.cyan('  Installed Version          : The version currently installed in node_modules or lock file.'));
    console.log(chalk.cyan('  Latest Version             : The most recent version available on npm.'));
    console.log(chalk.cyan('  Published Date             : The publication date of the latest version.'));
    console.log(chalk.cyan('  Upgrade Need Type          : The type of update required (major, minor, patch, or none).'));
    console.log(chalk.cyan('  Will Self-Upgrade          : Indicates if the package will self-upgrade based on the highest satisfying version.'));
    console.log(chalk.cyan('------------------------------------------------------------\n'));
}

// Format hyperlink
function createHyperlink(label, url) {
    return `\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`;
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const checkSpecificPackage = args.includes('--check') ? args[args.indexOf('--check') + 1] : null;

    console.log(chalk.bold.cyan('\nChecking dependencies...\n'));
    displayDescriptions();

    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    } catch (error) {
        console.error(chalk.red(`Error: Could not read or parse 'package.json'.`));
        process.exit(1);
    }

    const dependencies = flattenDependencies({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.overrides,
    });

    if (checkSpecificPackage && !dependencies[checkSpecificPackage]) {
        console.error(chalk.red(`Error: Package "${checkSpecificPackage}" is not listed in package.json.`));
        process.exit(1);
    }

    let installedDependencies = {};
    try {
        if (fs.existsSync('./package-lock.json')) {
            const packageLockJson = JSON.parse(fs.readFileSync('./package-lock.json', 'utf-8'));
            installedDependencies = packageLockJson.dependencies || {};
        } else if (fs.existsSync('./yarn.lock')) {
            installedDependencies = parseYarnLock('./yarn.lock');
        } else {
            console.error(chalk.red(`Error: Neither 'package-lock.json' nor 'yarn.lock' was found.`));
            process.exit(1);
        }
    } catch (error) {
        console.error(chalk.red(`Error: Could not read or parse lock file.`));
        process.exit(1);
    }

    const packagesToCheck = checkSpecificPackage ? { [checkSpecificPackage]: dependencies[checkSpecificPackage] } : dependencies;

    const results = await Promise.all(
        Object.entries(packagesToCheck).map(async ([packageName, currentVersionRange]) => {
            const versionInfo = await getLastVersionInfo(packageName);
            const installedVersion = getInstalledVersion(packageName, installedDependencies);
            if (versionInfo) {
                const { latestVersion, latestVersionDate, allVersions } = versionInfo;

                // Handle complex ranges like ">=3.0.1 <=5.0.1" or ">=2.6.4 <3"
                const satisfyingVersions = allVersions.filter(version => semver.satisfies(version, currentVersionRange));
                const highestSatisfyingVersion = satisfyingVersions.length
                    ? satisfyingVersions.sort(semver.rcompare)[0]
                    : null;

                const upgradeType = highestSatisfyingVersion
                    ? checkUpgradeType(installedVersion, latestVersion)
                    : 'unknown';
                const selfUpgrade = highestSatisfyingVersion
                    ? willSelfUpgrade(currentVersionRange, highestSatisfyingVersion, installedVersion, latestVersion)
                    : false;

                return {
                    packageName: createHyperlink(packageName, `https://www.npmjs.com/package/${packageName}`),
                    currentVersionRange,
                    highestSatisfyingVersion,
                    installedVersion,
                    latestVersion,
                    latestVersionDate,
                    upgradeType,
                    selfUpgrade,
                };
            }
        })
    );

    results
        .filter(Boolean)
        .forEach(result => {
            const {
                packageName,
                currentVersionRange,
                highestSatisfyingVersion,
                installedVersion,
                latestVersion,
                latestVersionDate,
                upgradeType,
                selfUpgrade,
            } = result;

            const formattedDate = latestVersionDate ? format(new Date(latestVersionDate), 'yyyy-MM-dd') : 'N/A';

            console.log(chalk.bold(`${packageName}`));
            console.log(chalk.magenta(`  Current Version Range      : ${currentVersionRange || 'N/A'}`));
            console.log(chalk.magenta(`  Highest Satisfying Version : ${highestSatisfyingVersion || 'N/A'}`));
            console.log(chalk.magenta(`  Installed Version          : ${installedVersion}`));
            console.log(chalk.blue(`  Latest Version             : ${latestVersion || 'N/A'}`));
            console.log(chalk.gray(`  Published Date             : ${formattedDate}`));
            console.log(chalk.green(`  Upgrade Need Type          : ${upgradeType}`));
            console.log(chalk.yellow(`  Will Self-Upgrade          : ${selfUpgrade ? 'Yes' : 'No'}`));
            console.log(chalk.magenta('------------------------------------------------------------'));
        });

    console.log(chalk.bold.cyan('\nDependency check completed.\n'));
}

main();
