
# **Dependency Checker**

A powerful CLI tool to analyze npm dependencies in your `package.json`. It checks if your dependencies, devDependencies, and overrides will automatically upgrade themselves based on semantic versioning rules. It also reports the latest version, publish dates, and whether the packages are up-to-date.

---

## **Features**
- Checks `dependencies`, `devDependencies`, and `overrides`.
- Identifies if a dependency will self-upgrade (`Yes` or `No`).
- Displays the latest version, publish date, and self-upgrade status.
- Allows filtering by specific packages with the `--check` option.
- Highlights recently published versions.

---

## **Installation**

1. Install globally from npm:
   ```bash
   npm install -g dependency-checker
   ```

2. Or use directly in your project:
   ```bash
   npm install dependency-checker --save-dev
   ```

---

## **Usage**

### **Check All Dependencies**
Run the tool in the directory containing your `package.json`:
```bash
dependency-checker
```

### **Check a Specific Package**
To analyze a specific package, use the `--check` option:
```bash
dependency-checker --check <package-name>
```

Example:
```bash
dependency-checker --check lodash
```

---

## **Output Example**

### **General Check**
```bash
Checking dependencies...

  ⚡ Recent | ✔ Up-to-date | Yes / No (Self-Upgrade)

  Package Name           | Current Version   | Latest Version    | Published Date   | Will Self-Upgrade
  -------------------------------------------------------------------------------------
  ⚡ lodash               | ^4.17.0          | 4.17.21           | 2023-12-05       | Yes
  ✔ chalk                | ^5.0.0           | 5.1.2             | 2023-10-10       | Yes
  ✔ axios                | ~1.1.0           | 1.2.3             | 2023-08-10       | No

Dependency check completed.
```

### **Check a Specific Package**
```bash
dependency-checker --check lodash

Checking dependencies...

  ⚡ Recent | ✔ Up-to-date | Yes / No (Self-Upgrade)

  Package Name           | Current Version   | Latest Version    | Published Date   | Will Self-Upgrade
  -------------------------------------------------------------------------------------
  ⚡ lodash               | ^4.17.0          | 4.17.21           | 2023-12-05       | Yes

Dependency check completed.
```

---

## **Options**

| Option            | Description                                        | Example                     |
|--------------------|----------------------------------------------------|-----------------------------|
| `--check`          | Analyze a specific package by name.               | `--check lodash`            |

---

## **How It Works**
1. Parses `dependencies`, `devDependencies`, and `overrides` from your `package.json`.
2. Fetches the latest version and publish date for each package using the npm registry API.
3. Compares the version constraints in your `package.json` against the latest version to determine:
   - If the package will self-upgrade.
   - If the version is up-to-date.

---

## **Development**

### Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/moumen-soliman/dependency-checker.git
   cd dependency-checker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Link the package locally for testing:
   ```bash
   npm link
   ```

4. Run the tool:
   ```bash
   dependency-checker
   ```

---

## **Contributing**

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

---

## **License**

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
