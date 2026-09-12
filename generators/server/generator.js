import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';

export default class extends BaseApplicationGenerator {
  initialRun;

  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true });
  }

  get [BaseApplicationGenerator.INITIALIZING]() {
    return this.asInitializingTaskGroup({
      // Runs before the prompts of `command.js`, which ask for the entities only on the first run.
      setInitialRun() {
        this.initialRun = this.blueprintConfig.encryptIdEnable === undefined;
      },
    });
  }

  get [BaseApplicationGenerator.COMPOSING]() {
    return this.asComposingTaskGroup({
      async composingTemplateTask() {
        if (this.blueprintConfig.encryptIdEnable) {
          const encryptIdEntities =
            this.blueprintConfig.encryptIdType === 'all'
              ? this.getExistingEntities().map(e => e.name)
              : this.blueprintConfig.encryptIdEntities;
          await this.composeWithJHipster('jhipster-encrypt-id:encrypt-id-java', { generatorOptions: { encryptIdEntities } });
        }
      },
    });
  }
}
