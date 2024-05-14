# generator-jhipster-encrypt-id

> JHipster blueprint, encrypt-id blueprint for JHipster

[![NPM version][npm-image]][npm-url]
[![Generator](https://github.com/hipster-labs/generator-jhipster-entity-audit/actions/workflows/generator.yml/badge.svg)](https://github.com/hipster-labs/generator-jhipster-entity-audit/actions/workflows/generator.yml)

# Introduction

This is a [JHipster](https://www.jhipster.tech/) blueprint, that is meant to be used in a JHipster application.

You can choose to encrypt the ids for all entities or choose the entities with encrypted ids from a list during generation.

The blueprint will encrypt the ids of all selected entities in the user interface and the REST API, but **NOT** in the 
database. This is done to prohibit the users from guessing valid ideas and by that preventing some kind of attacks against
the application and also hiding some information, like the number of users, transactions, etc.



