# Publishing

This repo is set up so `npm pack`, `npm publish --dry-run`, and `npm publish`
all build the package from a clean `dist/` automatically.

Before publishing, make sure you can publish the configured package name and
that you are authenticated with npm:

```sh
npm whoami
```

If this is your first time publishing this package, use this checklist:

1. Ensure the package.json "name" matches what you want it to be called. It
   should either be like `my-package` or `@my-org/my-package`. If it's the
   latter, ensure you have an npmjs account with permissions to push to
   `my-org`.
2. `npm login` if `npm whoami` fails.
3. Install dependencies. This repo currently uses Bun for lockfile management:

   ```sh
   bun install --frozen-lockfile
   ```

4. Run the local validation steps:

   ```sh
   npm run build:clean
   npm run test
   npm run lint
   npm run typecheck
   ```

5. Inspect the exact publish payload:

   ```sh
   npm run pack:dry-run
   ```

6. (Optional) `npm pack` will create a .tgz file of the package. You can then
   try installing it in another project with
   `npm install ./path/to/your-package.tgz` to sanity check that it works as
   expected. You can remove the .tgz file after.
7. Run a full publish dry run:

   ```sh
   npm publish --dry-run
   ```

8. `npm publish` to publish the package to npm.
9. `git tag v0.1.0` to tag the new version.
10. `git push --follow-tags` to push the tags to the repository. This way, other
    contributors can always see what code was published with each version.
    Running `npm version ...` will create these tags and commits automatically.

After the initial publish, you can use the release scripts documented below.

## Package scripts for releasing

In package.json, there are some scripts that are useful for doing releases.

- `preversion` will rebuild the package and run tests, lint, and typecheck
  before marking a new version.
- `version` will open the changelog in vim and then save it before committing
  the new version.
- `prepack` will make a clean build before packing or publishing.
- `prepublishOnly` will run tests, lint, and typecheck before publishing.

These are not required and can be modified or removed if desired. They will all
be run automatically when using one of the deployment commands.

## Deploying a new alpha version

```sh
npm run alpha
```

This will create a prerelease version with an `@alpha` tag. It will then publish
the package to npm and push the code and new tag. Users can install the package
with `npm install @your-package@alpha`.

## Deploying a new release version

```sh
npm run release
```

This will create a patch version and publish as `latest`. It will then publish
the package to npm and push the code and new tag. To publish a new minor or
major version, you can run the commands manually:

```sh
npm version minor # or major
npm publish
git push --follow-tags
```

## Building a one-off package

```sh
npm run build:clean
npm pack
```

You can then provide the .tgz file to others to install via
`npm install ./path/to/your-package.tgz`.
