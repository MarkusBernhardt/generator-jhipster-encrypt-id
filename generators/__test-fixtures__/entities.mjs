/**
 * Entity model used by the blueprint tests.
 *
 * It covers every relationship type (One-to-One, Many-to-One, One-to-Many, Many-to-Many),
 * a relationship to the built in `User` entity and a relationship to an entity whose id is
 * *not* encrypted, so that the mixed setup is covered as well.
 */

const base = {
  dto: 'mapstruct',
  service: 'serviceImpl',
};

const encrypted = {
  ...base,
  enableEncryptId: true,
};

const entities = [
  {
    name: 'Alpha',
    ...encrypted,
    fields: [
      { fieldName: 'name', fieldType: 'String' },
      // `identifier` must not be converted, it only looks like the id of the entity.
      { fieldName: 'identifier', fieldType: 'Long' },
      { fieldName: 'counter', fieldType: 'Integer' },
    ],
    relationships: [
      {
        relationshipName: 'beta',
        otherEntityName: 'beta',
        relationshipType: 'one-to-one',
        ownerSide: true,
        otherEntityRelationshipName: 'alpha',
      },
      { relationshipName: 'gamma', otherEntityName: 'gamma', relationshipType: 'many-to-one', otherEntityRelationshipName: 'alphas' },
      { relationshipName: 'deltas', otherEntityName: 'delta', relationshipType: 'one-to-many', otherEntityRelationshipName: 'alpha' },
      {
        relationshipName: 'epsilons',
        otherEntityName: 'epsilon',
        relationshipType: 'many-to-many',
        ownerSide: true,
        otherEntityRelationshipName: 'alphas',
      },
      { relationshipName: 'zeta', otherEntityName: 'zeta', relationshipType: 'many-to-one', otherEntityRelationshipName: 'alphas' },
      { relationshipName: 'user', otherEntityName: 'user', relationshipType: 'many-to-one' },
    ],
  },
  {
    name: 'Beta',
    ...encrypted,
    fields: [{ fieldName: 'name', fieldType: 'String' }],
    relationships: [
      {
        relationshipName: 'alpha',
        otherEntityName: 'alpha',
        relationshipType: 'one-to-one',
        ownerSide: false,
        otherEntityRelationshipName: 'beta',
      },
    ],
  },
  {
    name: 'Gamma',
    ...encrypted,
    fields: [{ fieldName: 'name', fieldType: 'String' }],
    relationships: [
      { relationshipName: 'alphas', otherEntityName: 'alpha', relationshipType: 'one-to-many', otherEntityRelationshipName: 'gamma' },
    ],
  },
  {
    name: 'Delta',
    ...encrypted,
    fields: [{ fieldName: 'name', fieldType: 'String' }],
    relationships: [
      { relationshipName: 'alpha', otherEntityName: 'alpha', relationshipType: 'many-to-one', otherEntityRelationshipName: 'deltas' },
    ],
  },
  {
    name: 'Epsilon',
    ...encrypted,
    fields: [{ fieldName: 'name', fieldType: 'String' }],
    relationships: [
      {
        relationshipName: 'alphas',
        otherEntityName: 'alpha',
        relationshipType: 'many-to-many',
        ownerSide: false,
        otherEntityRelationshipName: 'epsilons',
      },
    ],
  },
  {
    // Not encrypted on purpose, relationships pointing to it have to keep their numeric id.
    name: 'Zeta',
    ...base,
    fields: [{ fieldName: 'name', fieldType: 'String' }],
    relationships: [
      { relationshipName: 'alphas', otherEntityName: 'alpha', relationshipType: 'one-to-many', otherEntityRelationshipName: 'zeta' },
    ],
  },
];

const encryptedEntityNames = entities.filter(entity => entity.enableEncryptId).map(entity => entity.name);

export default entities;
export { encryptedEntityNames };
