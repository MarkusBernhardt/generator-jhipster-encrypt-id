# generator-jhipster-encrypt-id

> JHipster blueprint, encrypt-id blueprint for JHipster

[![NPM version][npm-image]][npm-url]
[![Generator](https://github.com/MarkusBernhardt/generator-jhipster-encrypt-id/actions/workflows/generator.yml/badge.svg)](https://github.com/MarkusBernhardt/generator-jhipster-encrypt-id/actions/workflows/generator.yml)

# Introduction

This is a [JHipster](https://www.jhipster.tech/) blueprint, that is meant to be used in a JHipster application.

You can choose to encrypt the ids for all entities or choose the entities with encrypted ids from a list during
generation.

The blueprint will encrypt the ids of all selected entities in the user interface and the REST API, but **NOT** in the
database. This is done to prohibit the users from guessing valid ids and by that preventing some kind of attacks
against the application and also hiding some information, like the number of users, transactions, etc.

# Prerequisites

As this is a [JHipster](https://www.jhipster.tech/) blueprint, we expect you have JHipster and its related tools already
installed:

- [Installing JHipster](https://www.jhipster.tech/installation/)

# Installation

To install or update this blueprint:

```bash
npm install -g generator-jhipster-encrypt-id
```

# Usage

To use this blueprint, run the below command

```bash
jhipster-encrypt-id
```

or

```bash
jhipster --blueprints encrypt-id
```

You can look for updated encrypt-id blueprint specific options by running

```bash
jhipster-encrypt-id app --help
```

And looking for `(blueprint option: encrypt-id)` options.

[npm-image]: https://img.shields.io/npm/v/generator-jhipster-encrypt-id.svg
[npm-url]: https://npmjs.org/package/generator-jhipster-encrypt-id
