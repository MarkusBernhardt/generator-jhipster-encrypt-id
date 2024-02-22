/**
 * @type {import('generator-jhipster').JHipsterCommandDefinition}
 */
const command = {
  options: {},
  configs: {
    encryptIdEnable: {
      cli: {
        type: Boolean,
      },
      prompt: {
        type: 'confirm',
        name: 'encryptIdEnable',
        message: 'Do you want to encrypt the ids of entities in the API and the UI?',
        default: true,
      },
      scope: 'blueprint',
    },
    encryptIdType: {
      cli: {
        type: String,
      },
      prompt: generator => ({
        when: answers => (generator.initialRun || generator.options.askAnswered) && answers.encryptIdEnable,
        type: 'list',
        name: 'encryptIdType',
        message: 'Do you want to encrypt the ids of all existing entities?',
        choices: [
          { name: 'Yes, update all', value: 'all' },
          { name: 'No, let me choose the entities to update', value: 'selected' },
        ],
        default: 'all',
      }),
      scope: 'generator',
    },
    encryptIdEntities: {
      cli: {
        type: Array,
      },
      prompt: generator => ({
        when: answers => answers.encryptIdType === 'selected',
        type: 'checkbox',
        message: 'Please choose the entities to be encrypted',
        choices: generator.getExistingEntities().map(e => e.name),
        default: [],
      }),
      scope: 'generator',
    },
  },
};

export default command;
