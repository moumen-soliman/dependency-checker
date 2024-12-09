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
        const data = await response.json();
        const latestVersion = data['dist-tags'].latest;
        const latestVersionDate = data.time[latestVersion];
        return { packageName, latestVersion, latestVersionDate };
    } catch (error) {
        console.error(`Failed to fetch data for ${packageName}:`, error);
        return null;
    }
}

// Check if the latest version satisfies the current range
function willSelfUpgrade(currentVersionRange, latestVersion) {
    return semver.satisfies(latestVersion, currentVersionRange);
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const checkPackage = args.includes('--check') ? args[args.indexOf('--check') + 1] : null;

    console.log(chalk.bold.cyan('\nChecking dependencies...\n'));

    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.overrides,
    };

    // If --check is specified, filter dependencies to only the specified package
    const filteredDependencies = checkPackage
        ? { [checkPackage]: dependencies[checkPackage] }
        : dependencies;

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

    const currentDate = new Date();

    console.log(
        chalk.bold.magenta(
            `\n  Package Name           | Current Version   | Latest Version    | Published Date   | Will Self-Upgrade`
        )
    );
    console.log(
        chalk.magenta(
            `  -------------------------------------------------------------------------------------`
        )
    );

    results
        .filter(Boolean) // Exclude any failed fetches
        .sort((a, b) => new Date(b.latestVersionDate) - new Date(a.latestVersionDate))
        .forEach(result => {
            const { packageName, currentVersionRange, latestVersion, latestVersionDate, selfUpgrade } = result;
            const publishDate = new Date(latestVersionDate);
            const isNear = differenceInDays(publishDate, currentDate) <= 10 && publishDate > currentDate;

            const statusIcon = isNear ? chalk.yellow('⚡') : chalk.green('✔');
            const selfUpgradeStatus = selfUpgrade ? chalk.green('Yes') : chalk.red('No');
            const formattedDate = format(publishDate, 'yyyy-MM-dd');

            console.log(
                `  ${statusIcon} ${chalk.bold(packageName.padEnd(20))} | ${chalk.magenta(
                    currentVersionRange.padEnd(17)
                )} | ${chalk.blue(latestVersion.padEnd(17))} | ${chalk.gray(
                    formattedDate.padEnd(16)
                )} | ${selfUpgradeStatus}`
            );
        });

    console.log(chalk.bold.cyan('\nDependency check completed.\n'));
}

main();
