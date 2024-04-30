import { beforeAll, describe, expect, it } from 'vitest';

import { defaultHelpers as helpers, result } from 'generator-jhipster/testing';

const SUB_GENERATOR = 'scmb-encrypt-id-java';
const SUB_GENERATOR_NAMESPACE = `jhipster-scmb-encrypt-id:${SUB_GENERATOR}`;

describe('SubGenerator scmb-encrypt-id-java of scmb-encrypt-id JHipster blueprint', () => {
  describe('run', () => {
    beforeAll(async function () {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [
          {
            name: 'Entities',
            enableAudit: true,
            fields: [
              {
                fieldName: 'name',
                fieldType: 'String',
              },
            ],
          },
        ])
        .withOptions({
          creationTimestamp: '2024-02-01',
          ignoreNeedlesError: true,
        })
        .withJHipsterLookup()
        .withParentBlueprintLookup();
    });

    it('should succeed', () => {
      expect(result.getStateSnapshot()).toMatchSnapshot();
    });
  });
});
