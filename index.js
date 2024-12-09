#!/usr/bin/env node

const fs = require('fs');
const chalk = require('chalk');
const semver = require('semver');
const { format, differenceInDays } = require('date-fns');

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

        return { packageName, latestVersion, latestVersionDate };
    } catch (error) {
        console.error(chalk.red(`Failed to fetch data for ${packageName}: ${error.message}`));
        return { packageName, latestVersion: null, latestVersionDate: null };
    }
}

// Check if the latest version satisfies the current range
function willSelfUpgrade(currentVersionRange, latestVersion) {
    if (!latestVersion) return false;
    return semver.satisfies(latestVersion, currentVersionRange);
}

// Format hyperlink
function createHyperlink(label, url) {
    return `\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`;
}

// Simple loading spinner
function startLoading(message) {
    const frames = ['-', '\\', '|', '/'];
    let i = 0;

    const interval = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan(frames[i++ % frames.length])} ${message}`);
    }, 100);

    return () => {
        clearInterval(interval);
        process.stdout.write('\r');
    };
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const checkIndex = args.indexOf('--check');
    const checkPackage = checkIndex !== -1 && args[checkIndex + 1] ? args[checkIndex + 1] : null;

    console.log(chalk.bold.cyan('\nChecking dependencies...\n'));

    // Read package.json
    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    } catch (error) {
        console.error(chalk.red(`Error: Could not read or parse 'package.json'. Ensure the file exists and is properly formatted.`));
        process.exit(1);
    }

    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.overrides,
    };

    let filteredDependencies;

    if (checkPackage) {
        if (!dependencies[checkPackage]) {
            console.error(chalk.red(`Error: Package '${checkPackage}' not found in dependencies.`));
            process.exit(1);
        }
        filteredDependencies = { [checkPackage]: dependencies[checkPackage] };
    } else {
        filteredDependencies = dependencies;
    }

    const stopLoading = startLoading('Fetching package information...');
    const results = await Promise.all(
        Object.entries(filteredDependencies).map(async ([packageName, currentVersionRange]) => {
            const versionInfo = await getLastVersionInfo(packageName);
            if (versionInfo) {
                const { latestVersion, latestVersionDate } = versionInfo;
                const selfUpgrade = willSelfUpgrade(currentVersionRange, latestVersion);
                return { packageName, currentVersionRange, latestVersion, latestVersionDate, selfUpgrade };
            }
        })
    );
    stopLoading();

    const currentDate = new Date();

    results
        .filter(Boolean)
        .sort((a, b) => new Date(b.latestVersionDate) - new Date(a.latestVersionDate))
        .forEach(result => {
            const { packageName, currentVersionRange, latestVersion, latestVersionDate, selfUpgrade } = result;
            const publishDate = latestVersionDate ? new Date(latestVersionDate) : null;
            const isNear = publishDate && differenceInDays(publishDate, currentDate) <= 10 && publishDate > currentDate;

            const statusIcon = isNear ? chalk.yellow('⚡') : chalk.green('✔');
            const formattedDate = publishDate ? format(publishDate, 'yyyy-MM-dd') : 'N/A';
            const packageLink = createHyperlink(packageName, `https://www.npmjs.com/package/${packageName}`);
            const versionLink = latestVersion
                ? createHyperlink(latestVersion, `https://www.npmjs.com/package/${packageName}/v/${latestVersion}`)
                : 'N/A';

            console.log(chalk.bold(`${statusIcon} ${packageLink}`));
            console.log(chalk.magenta(`  Current Version  : ${currentVersionRange || 'N/A'}`));
            console.log(chalk.blue(`  Latest Version   : ${versionLink}`));
            console.log(chalk.gray(`  Published Date   : ${formattedDate}`));
            console.log(
                chalk.bold(`  Will Self-Upgrade: ${selfUpgrade ? chalk.green('Yes') : chalk.red('No')}`)
            );
            console.log(chalk.magenta('------------------------------------------------------------'));
        });

    console.log(chalk.bold.cyan('\nDependency check completed.\n'));
}

main();
