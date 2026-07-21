# eslint-plugin-eslint-lensflow

Leverage the type system for better software design and implementation

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `eslint-plugin-eslint-lensflow`:

```sh
npm install eslint-plugin-eslint-lensflow --save-dev
```

## Usage

In your [configuration file](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-file), import the plugin `eslint-plugin-eslint-lensflow` and add `eslint-lensflow` to the `plugins` key:

```js
import { defineConfig } from "eslint/config";
import eslint-lensflow from "eslint-plugin-eslint-lensflow";

export default defineConfig([
    {
        plugins: {
            eslint-lensflow
        }
    }
]);
```

Then configure the rules you want to use under the `rules` key.

```js
import { defineConfig } from "eslint/config";
import eslint-lensflow from "eslint-plugin-eslint-lensflow";

export default defineConfig([
    {
        plugins: {
            eslint-lensflow
        },
        rules: {
            "eslint-lensflow/rule-name": "warn"
        }
    }
]);
```

## Configurations

<!-- begin auto-generated configs list -->

TODO: Run eslint-doc-generator to generate the configs list (or delete this section if no configs are offered).
<!-- end auto-generated configs list -->

## Rules

<!-- begin auto-generated rules list -->

TODO: Run eslint-doc-generator to generate the rules list.
<!-- end auto-generated rules list -->
