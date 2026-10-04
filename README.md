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

# Compatibility

Every major version of the blueprint targets one major version of JHipster.

| Blueprint | JHipster | Node                      |
| --------- | -------- | ------------------------- |
| 1.x       | 9.x      | `^22.18.0 \|\| >=24.11.0` |
| 0.99.x    | 8.x      | `^18.13.0 \|\| >= 20.6.1` |

The blueprint declares the supported JHipster version in `engines`, so `npm` reports a mismatch during the
installation.

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

The options can also be passed on the command line, which is what the tests and the sample do:

```bash
jhipster-encrypt-id jdl sample.jdl --encrypt-id-enable --encrypt-id-type all
```

## Pre-release

To use an unreleased version, install it using git.

```bash
npm install -g jhipster/generator-jhipster-encrypt-id#main
jhipster --blueprints encrypt-id --skip-jhipster-dependencies
```

# How it works

For every entity with an encrypted id the blueprint generates an `<Entity>IdCipher` in `service/cipher`. The cipher
encrypts the `Long` id of the database into a hex string using `AES/CBC/PKCS5Padding` and decrypts it back. The
encrypted value carries a magic number, so a tampered or foreign id is rejected with an `InvalidIdException`, see
[Invalid ids](#invalid-ids).

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

## Invalid ids

An encrypted id is exactly one cipher block, written as 32 lower case hex digits. Anything else is rejected before it
is decrypted. An id with the right format that does not decrypt to a database id of the entity is rejected as well:
a tampered id or an id of another entity. Every invalid id fails with the same `InvalidIdException`, an
`IdCipherException` annotated with `@ResponseStatus(code = HttpStatus.BAD_REQUEST, reason = "Invalid id")`, so the
REST API answers `400 Invalid id`.

Accepting a single block only is what rules out a padding oracle: the block in front of the decrypted one is always
the fixed initialization vector, so a client controls nothing that is combined with it. Answering every invalid id
identically, without a cause, is defence in depth. Up to 1.0.1 both were missing, and every endpoint that decrypts an
id let a client recover the database id behind an encrypted id without knowing the key.

The blueprint generates an `IdCipherTest` and an invalid id test in every `<Entity>ResourceIT`, which check this in
the application.

Upgrading from 1.0.1 or older:

- An invalid id is answered with `400` instead of `500`, and the message and cause of the old `IdCipherException`
  are gone. Code that catches `IdCipherException` keeps working, `InvalidIdException` extends it.
- An upper or mixed case spelling of an encrypted id is rejected. The server always issues lower case ids, so only
  clients that change the case are affected.
- Ids issued before stay valid, the encryption is unchanged.
- `src/test/java/<package>/service/cipher/IdCipherTest.java` is generated now and replaces a test of that name.

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
exposed by `UserDTO`, `AdminUserDTO`, the account API and the user administration.

Since JHipster 9 the user administration is generated as the regular entity `UserManagement` in
`entities/admin/user-management`, so the blueprint converts it like any other entity with an encrypted id.

`POST /api/admin/users` answers with an `AdminUserDTO` instead of the `User` entity, because the entity would
carry the plain database id in its response.

## Filtering

With filtering (`filter` in the JDL, `jpaMetamodelFiltering`) every filter of a criteria that receives an encrypted
id takes the encrypted id, exactly as the API returns it, and never the database id:

- the `id` of an entity with encrypted id,
- every relationship to an entity with encrypted id or to the `User`, of any type and on either side: Many-to-One,
  One-to-One owner and inverse side, the back reference of a One-to-Many, Many-to-Many on both sides. This includes
  the relationships of an entity **without** encrypted id, for example `zetaId` of an unencrypted `Zeta`.

These filters are of type `EncryptedIdFilter<XIdCipher>`, a `Filter<String>` (a `RangeFilter<String>` with
[range operators](#range-operators)). The generated `<Entity>QueryService`
decrypts them right before the specification is built, the specification still works on the database ids:

```java
buildSpecification(clientIdCipher.decryptFilter(criteria.getDebtorId()), root -> root.join(Mandate_.debtor, JoinType.LEFT).get(Client_.id))
```

All other filters are unchanged and keep every operator of JHipster, including the ranges, for example a `Long`
field `identifier`, the id of an entity without encrypted id and a relationship to such an entity.

| Operator on an encrypted id                                        | Value                                        |
| ------------------------------------------------------------------ | -------------------------------------------- |
| `equals`, `notEquals`                                              | one encrypted id                             |
| `in`, `notIn`                                                      | encrypted ids, comma separated or repeated   |
| `specified`                                                        | `true` or `false`                            |
| `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` | rejected, unless [enabled](#range-operators) |

An empty value (`clientId.equals=`) or an empty element of a list means no value, exactly like for a `LongFilter`.

| Request                                                                   | Answer                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| encrypted id of the referenced entity                                     | `200`                                             |
| database id, id of another entity, tampered id, upper case, anything else | `400 Invalid id`, see [Invalid ids](#invalid-ids) |
| one invalid id in a list                                                  | `400 Invalid id` for the whole request            |
| range operator on an encrypted id, unless [enabled](#range-operators)     | `400`, `message` is `error.validation`            |

The list and the `/count` endpoint answer alike. Decryption happens before any SQL is executed.

### Range operators

The range operators are rejected by default. They can be enabled for all filters on encrypted ids with the option
`--encrypt-id-range-filter`, which is stored as `encryptIdRangeFilter` in the `generator-jhipster-encrypt-id` section
of `.yo-rc.json`:

```json
{
  "generator-jhipster-encrypt-id": {
    "encryptIdEnable": true,
    "encryptIdType": "all",
    "encryptIdRangeFilter": true
  }
}
```

Regenerate the application after changing it, `--no-encrypt-id-range-filter` disables it again. With the option,
`greaterThan`, `greaterThanOrEqual`, `lessThan` and `lessThanOrEqual` take encrypted ids as well. Every value is
decrypted with the cipher of the referenced entity and the comparison runs on the database ids, never on the
encrypted strings. A database id, an id of another entity or any other invalid id is still answered with
`400 Invalid id`.

What this reveals: a value has to decrypt with the right cipher, so a client can only compare against ids it already
received. A range then tells the order of these known ids and how many entities lie between them, which cursor based
paging and `sort=id` expose anyway. Raw database ids are never accepted and never revealed. Keep the default for APIs
that do not offer this already, and enable it for APIs with cursor based paging: a cursor `after=<encrypted id>`
becomes `id.greaterThan=<encrypted id>`.

### Choosing the cipher

The cipher always comes from the entity model, never from the name of the filter: `debtorId` of a `Mandate` is
decrypted with the `ClientIdCipher` if the relationship `debtor` references a `Client`. The own id uses the cipher of
the entity, a relationship the cipher of the referenced entity, a relationship to the user the `UserIdCipher`.

The compiler checks the choice: `EncryptedIdFilter<ClientIdCipher>` is only accepted by
`ClientIdCipher.decryptFilter(...)`, and a query service that hands the filter to `buildSpecification` without
decrypting it does not compile either.

The ciphers are injected into `protected` fields of the query service, with setters, so the constructor of the query
service stays as JHipster generates it.

### Angular

Nothing to change. The "Show ..." buttons of the generated list pages already send the encrypted id of the entity,
for example `filter[clientId.in]=<encrypted id>`, and work with the encrypted filters as they are.

### Programmatic use

A criteria holds encrypted ids. Code that receives encrypted ids passes them straight through:

```java
MandateCriteria criteria = new MandateCriteria();
criteria.debtorId().setEquals(encryptedClientId);
```

Code that only has a database id encrypts it first, `criteria.id().setEquals(clientIdCipher.encrypt(id))`. Setting a
`Long` does not compile. Without range operators, calling a range setter compiles with a deprecation warning and
throws.

Without [range operators](#range-operators), a range on the database ids, for example for cursor based paging,
belongs into a subclass of the query service, which can use the `protected` ciphers and `createSpecification`:

```java
LongFilter cursor = new LongFilter();
cursor.setGreaterThan(mandateIdCipher.decrypt(after)); // an invalid cursor is answered with 400 Invalid id
Specification<Mandate> specification = createSpecification(criteria).and(buildRangeSpecification(cursor, Mandate_.id));
```

### Known limitations

- `sort=id` still orders by the database id and so reveals the order in which the entities were created. This is
  independent of filtering.
- Filtering by the back reference of a One-to-Many without `distinct=true` can return an entity several times, so
  `/count` can be larger than the list. This is the behavior of JHipster.
- A reactive application with a filter on an encrypted id is rejected by the generator.
- After enabling the encryption for an entity, regenerate every entity that references it, otherwise their criteria
  still take the database id. When upgrading the blueprint, regenerate all entities, every `<Entity>IdCipher` needs
  `decryptFilter`.

# Requirements and limitations

An entity with an encrypted id must be configured with

- `dto mapstruct` — the id is converted in the MapStruct mapper,
- `service serviceImpl` — the id is decrypted in the service implementation.

The generator fails with an explicit error message if one of them is missing.

Filtering (`jpaMetamodelFiltering`) is supported, see [Filtering](#filtering).

Not supported:

- Id types other than `Long`. `Integer` and `UUID` ids are not converted.
- Clients other than Angular. Only the Angular client is adapted.
- Filtering by an encrypted id in a reactive application. The generator fails with an explicit error message.

# Development

```bash
npm install
npm test
```

The tests generate a complete application with entities that use every relationship type, a relationship to the
`User` entity and a relationship to an entity without an encrypted id, and assert on the generated sources. The
entity model used by the tests lives in `generators/__test-fixtures__/entities.js`.

To generate a real application with the blueprint, use the sample:

```bash
npm link
cd /some/empty/folder
jhipster-encrypt-id jdl path/to/generator-jhipster-encrypt-id/.blueprint/generate-sample/templates/samples/sample.jdl \
  --encrypt-id-enable --encrypt-id-type all
```

[npm-image]: https://img.shields.io/npm/v/generator-jhipster-encrypt-id.svg
[npm-url]: https://npmjs.org/package/generator-jhipster-encrypt-id
