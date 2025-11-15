# GitHub Release Guide for Obsidian Community Plugin

This document outlines the steps required to create a GitHub release that contains the necessary files for making the Relation Explorer plugin available as an Obsidian community plugin.

## Overview

To publish an Obsidian plugin to the community plugin store, you need to:

1. Build the plugin files
2. Create a GitHub release with specific required files
3. Submit a pull request to the Obsidian community plugins repository

## Required Files for Release

Every GitHub release for an Obsidian plugin must include these three files:

- **`main.js`** - The compiled plugin code
- **`manifest.json`** - Plugin metadata and configuration
- **`styles.css`** (optional but recommended) - Custom styles for the plugin

## Pre-Release Checklist

### 1. Update Version Numbers

Before creating a release, ensure version numbers are consistent across all files.

#### Automated Version Update (Recommended)

Use the included version management script to update both files simultaneously:

```bash
npm run version 1.0.0
```

This script:
- Updates the version in both [`manifest.json`](../manifest.json:4) and [`package.json`](../package.json:3)
- Validates semantic versioning format
- Provides helpful next steps for creating the release

**Usage examples:**
```bash
npm run version 1.0.0        # Major release
npm run version 0.1.0        # Minor release
npm run version 0.0.1        # Patch release
npm run version 1.0.0-beta.1 # Pre-release
```

#### Manual Version Update

Alternatively, you can manually update both files:

**[`manifest.json`](../manifest.json:4):**
```json
{
  "version": "1.0.0"
}
```

**[`package.json`](../package.json:3):**
```json
{
  "version": "1.0.0"
}
```

**Note:** Both files must have the same version number. Use semantic versioning (MAJOR.MINOR.PATCH).

### 2. Update Minimum Obsidian Version

In [`manifest.json`](../manifest.json:5), verify the `minAppVersion` field:

```json
{
  "minAppVersion": "1.0.0"
}
```

Set this to the minimum Obsidian version your plugin supports. You can find Obsidian version history at: https://github.com/obsidianmd/obsidian-releases

### 3. Build the Plugin

Build the production version of your plugin:

```bash
npm install
npm run build
```

This generates the [`main.js`](../main.js) file in your project root.

### 4. Test the Build

Before releasing, test the built plugin:

1. Copy `main.js` and `manifest.json` to a test vault:
   ```
   <test-vault>/.obsidian/plugins/relations-obsidian/
   ```
2. Reload Obsidian and enable the plugin
3. Verify all functionality works as expected
4. Check the console for errors (Ctrl+Shift+I / Cmd+Option+I)

### 5. Create or Update `styles.css` (Optional)

If your plugin includes custom styles, create a [`styles.css`](../styles.css) file in the project root. Even if you don't have custom styles yet, it's good practice to include an empty or minimal `styles.css`:

```css
/* Relation Explorer Plugin Styles */

/* Add custom styles here as needed */
```

## Creating the GitHub Release

### Step 1: Commit and Push Changes

Ensure all changes are committed and pushed to GitHub:

```bash
git add .
git commit -m "Prepare for v1.0.0 release"
git push origin main
```

### Step 2: Create a Git Tag

Create and push a version tag:

```bash
git tag -a 1.0.0 -m "Release version 1.0.0"
git push origin 1.0.0
```

**Important:** The tag name must match the version in `manifest.json` and `package.json`.

### Step 3: Create GitHub Release

#### Via GitHub Web Interface:

1. Navigate to your repository on GitHub
2. Click on "Releases" in the right sidebar
3. Click "Draft a new release"
4. Fill in the release form:
   - **Tag version:** Select the tag you just created (e.g., `1.0.0`)
   - **Release title:** Use a descriptive title (e.g., "Release 1.0.0" or "Initial Release")
   - **Description:** Add release notes describing:
     - New features
     - Bug fixes
     - Breaking changes
     - Known issues
5. Upload the required files by dragging them to the "Attach binaries" section:
   - `main.js`
   - `manifest.json`
   - `styles.css` (if applicable)
6. If this is a pre-release or beta version, check "This is a pre-release"
7. Click "Publish release"

#### Via GitHub CLI:

If you have GitHub CLI installed:

```bash
gh release create 1.0.0 \
  --title "Release 1.0.0" \
  --notes "Initial release of Relation Explorer plugin" \
  main.js \
  manifest.json \
  styles.css
```

### Step 4: Verify the Release

After publishing:

1. Go to your repository's Releases page
2. Verify the release is visible
3. Check that all three files are attached
4. Test downloading the files to ensure they're not corrupted

## Automation with GitHub Actions (Recommended)

To streamline future releases, consider adding a GitHub Actions workflow that automatically builds and uploads release assets.

Create `.github/workflows/release.yml`:

```yaml
name: Release Build

on:
  push:
    tags:
      - '*'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build plugin
        run: npm run build
      
      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            main.js
            manifest.json
            styles.css
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

With this workflow:
1. Push a new tag: `git tag 1.0.0 && git push origin 1.0.0`
2. GitHub Actions automatically builds and creates the release
3. No manual file uploads needed

## Submitting to Obsidian Community Plugins

Once you have a stable release, you can submit your plugin to the official Obsidian community plugins repository.

### Prerequisites

- At least one GitHub release with required files
- A well-documented README
- Plugin tested and working on latest Obsidian version
- No major bugs or security issues

### Submission Process

1. **Fork the community plugins repository:**
   ```
   https://github.com/obsidianmd/obsidian-releases
   ```

2. **Add your plugin to `community-plugins.json`:**
   
   Add an entry in alphabetical order:
   ```json
   {
     "id": "relations-obsidian",
     "name": "Relation Explorer",
     "author": "Fabian Kloosterman",
     "description": "Visualize parent/child relationships between notes based on user-defined frontmatter fields.",
     "repo": "fkloosterman/relations-obsidian"
   }
   ```

3. **Create a pull request:**
   - Title: "Add Relation Explorer plugin"
   - Description: Brief overview of what your plugin does
   - Link to your plugin's repository
   - Mention that you've tested it thoroughly

4. **Wait for review:**
   - Obsidian team will review your plugin
   - They may request changes or ask questions
   - Address any feedback promptly

5. **Plugin approval:**
   - Once approved and merged, your plugin will appear in the Community Plugins browser
   - This may take a few days to a week

## Release Best Practices

### Versioning Strategy

Follow semantic versioning:

- **MAJOR (1.0.0):** Breaking changes or major new features
- **MINOR (0.1.0):** New features, backward compatible
- **PATCH (0.0.1):** Bug fixes and minor improvements

### Release Notes Template

Use a consistent format for release notes:

```markdown
## What's New

- Feature 1 description
- Feature 2 description

## Improvements

- Enhancement 1
- Enhancement 2

## Bug Fixes

- Fix for issue #123
- Fix for issue #124

## Breaking Changes

- List any breaking changes here

## Known Issues

- List any known issues
```

### Pre-Release Testing Checklist

Before each release:

- [ ] All TypeScript compilation errors resolved
- [ ] Plugin loads without errors in Obsidian
- [ ] All core features working as expected
- [ ] No console errors during normal operation
- [ ] Tested on both desktop and mobile (if applicable)
- [ ] README.md is up to date
- [ ] Version numbers updated in all files
- [ ] CHANGELOG.md updated (if you maintain one)

## Troubleshooting

### Common Issues

**Issue: "main.js not found"**
- Solution: Run `npm run build` before creating the release

**Issue: "Version mismatch"**
- Solution: Ensure `manifest.json` and `package.json` have the same version

**Issue: "Plugin won't load in Obsidian"**
- Check browser console for errors
- Verify `manifest.json` is valid JSON
- Ensure `minAppVersion` is not higher than your Obsidian version

**Issue: "Release files corrupted"**
- Re-build the plugin
- Upload files again
- Verify file sizes match expected values

## Resources

- **Obsidian Plugin Documentation:** https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- **Sample Plugin Repository:** https://github.com/obsidianmd/obsidian-sample-plugin
- **Community Plugins Repository:** https://github.com/obsidianmd/obsidian-releases
- **Obsidian API Reference:** https://github.com/obsidianmd/obsidian-api
- **Plugin Developer Docs:** https://marcus.se.net/obsidian-plugin-docs/

## Changelog Maintenance

Consider maintaining a `CHANGELOG.md` file in your repository root to track changes across versions:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-15

### Added
- Initial release
- Parent-child relationship visualization
- Configurable parent field name
- Automatic graph building and updates

### Fixed
- N/A

### Changed
- N/A
```

## Next Steps After First Release

1. **Monitor Issues:** Watch for bug reports and feature requests
2. **Plan Updates:** Schedule regular releases with improvements
3. **Engage Community:** Respond to user feedback on GitHub
4. **Document Changes:** Keep README and docs updated
5. **Test Compatibility:** Verify plugin works with new Obsidian versions

---

## Quick Reference: Release Checklist

- [ ] Update version with `npm run version <new-version>` (or manually update both files)
- [ ] Update `minAppVersion` if needed
- [ ] Run `npm run build`
- [ ] Test plugin in Obsidian
- [ ] Commit and push changes: `git commit -am "Bump version to X.Y.Z"`
- [ ] Create and push git tag: `git tag X.Y.Z && git push origin X.Y.Z`
- [ ] GitHub Actions automatically creates release (or create manually)
- [ ] Verify release is accessible and files are attached
- [ ] (Optional) Submit to community plugins

---

*Last updated: 2025-01-14*