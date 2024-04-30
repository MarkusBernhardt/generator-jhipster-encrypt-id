import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import command from './command.mjs';

export default class extends BaseApplicationGenerator {
  initialRun;

  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true });
  }

  get [BaseApplicationGenerator.INITIALIZING]() {
    return this.asInitializingTaskGroup({
      setInitialRun() {
        this.initialRun = this.blueprintConfig.encryptIdEnable === undefined;
      },
      async initializingTemplateTask() {
        this.parseJHipsterArguments(command.arguments);
        this.parseJHipsterOptions(command.options);
      },
    });
  }

  get [BaseApplicationGenerator.PROMPTING]() {
    return this.asPromptingTaskGroup({
      async promptingTemplateTask() {
        await this.prompt(this.prepareQuestions(command.configs));
      }
    });
  }

  get [BaseApplicationGenerator.COMPOSING]() {
    return this.asComposingTaskGroup({
      async composingTemplateTask() {
        if (this.blueprintConfig.encryptIdEnable) {
          const encryptIdEntities = this.blueprintConfig.encryptIdType === "all" ? this.getExistingEntities().map(e => e.name) : this.blueprintConfig.encryptIdEntities;
          await this.composeWithJHipster("jhipster-encrypt-id:encrypt-id-java", { generatorOptions: { encryptIdEntities } });
        }
      }
    });
  }
}
