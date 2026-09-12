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

## Pre-release

To use an unreleased version, install it using git.

```bash
npm install -g jhipster/generator-jhipster-encrypt-id#main
jhipster --blueprints encrypt-id --skip-jhipster-dependencies
```

# How it works

For every entity with an encrypted id the blueprint generates an `<Entity>IdCipher` in `service/cipher`. The cipher
encrypts the `Long` id of the database into a hex string using `AES/CBC/PKCS5Padding` and decrypts it back. The
encrypted value carries a magic number, so a tampered or foreign id is rejected with an `IdCipherException`.

The `id` of the DTO becomes a `String`, the `id` of the entity stays a `Long`. The conversion happens in the MapStruct
mapper of the entity, which is turned from an interface into an abstract class, so that it can hold the ciphers:

```java
@Mapping(target = "id", expression = "java(alphaIdCipher.encrypt(s.getId()))")
public abstract AlphaDTO toDto(Alpha s);

@Mapping(target = "id", expression = "java(alphaIdCipher.decrypt(alphaDTO.getId()))")
public abstract Alpha toEntity(AlphaDTO alphaDTO);
```

The REST resource and the service accept the encrypted id as a `String` and decrypt it before the repository is used.

## Key and initialization vector

Every entity uses its **own** initialization vector, derived from the name of the entity. The same database id
therefore results in a different encrypted id for every entity, and an id of one entity cannot be used for another
one.

The key is read from the application properties:

```yaml
application:
  encrypt-id:
    key: 'change me'
```

The blueprint writes `change me` as a placeholder into `application.yml`, `application-dev.yml` and
`application-prod.yml`. **Replace it and keep it secret.** Changing the key invalidates every id that was handed out
before, for example ids inside bookmarked urls.

## Relationships

All relationship types are supported: One-to-One, Many-to-One, One-to-Many and Many-to-Many, including relationships
to the built in `User` entity.

JHipster maps a relationship to a DTO that only carries the id of the related entity. That id is encrypted with the
cipher of the **related** entity, not with the cipher of the owning entity:

```java
@Named("betaId")
@BeanMapping(ignoreByDefault = true)
@Mapping(target = "id", expression = "java(betaIdCipher.encrypt(beta.getId()))")
public abstract BetaDTO toDtoBetaId(Beta beta);

@BeanMapping(ignoreByDefault = true)
@Mapping(target = "id", expression = "java(betaIdCipher.decrypt(dto.getId()))")
public abstract Beta toEntityBeta(BetaDTO dto);
```

If a relationship points to an entity **without** an encrypted id, the id of that relationship keeps its numeric type
and is not touched. Encrypted and unencrypted entities can be mixed in one application.

## The User entity

The id of the built in `User` entity is **always** encrypted as soon as the blueprint is enabled, because it is
exposed by `UserDTO`, `AdminUserDTO`, the account API and the user management screens.

# Requirements and limitations

An entity with an encrypted id must be configured with

- `dto mapstruct` — the id is converted in the MapStruct mapper,
- `service serviceImpl` — the id is decrypted in the service implementation.

The generator fails with an explicit error message if one of them is missing.

Not supported:

- **Filtering** (`jpaMetamodelFiltering`). The generated `<Entity>Criteria` exposes the database ids as plain
  `LongFilter`, which would allow querying and reading the unencrypted ids through the REST API. The generator fails
  for an entity that combines an encrypted id with filtering. Entities without an encrypted id can still use
  filtering.
- Id types other than `Long`. `Integer` and `UUID` ids are not converted.
- Clients other than Angular. Only the Angular client is adapted.

# Development

```bash
npm install
npm test
```

The tests generate a complete application with entities that use every relationship type, a relationship to the
`User` entity and a relationship to an entity without an encrypted id, and assert on the generated sources. The
entity model used by the tests lives in `generators/__test-fixtures__/entities.mjs`.

[npm-image]: https://img.shields.io/npm/v/generator-jhipster-encrypt-id.svg
[npm-url]: https://npmjs.org/package/generator-jhipster-encrypt-id
