import { describe, expect, it } from 'vitest';

import { addConstructorParameter, collectNestedDtoClasses, quoteObjectIds } from './encrypt-id-util.js';

describe('encrypt-id-util', () => {
  describe('collectNestedDtoClasses', () => {
    it('should find the dto of a single valued relationship', () => {
      expect([...collectNestedDtoClasses('    private BetaDTO beta;')]).toEqual(['Beta']);
    });

    it('should find the dto of a collection valued relationship', () => {
      expect([...collectNestedDtoClasses('    private Set<EpsilonDTO> epsilons = new HashSet<>();')]).toEqual(['Epsilon']);
    });

    it('should report every related dto exactly once', () => {
      const dto = [
        '    private String id;',
        '    private Long identifier;',
        '    private BetaDTO beta;',
        '    private BetaDTO otherBeta;',
        '    private Set<EpsilonDTO> epsilons = new HashSet<>();',
        '    private UserDTO user;',
      ].join('\n');

      expect([...collectNestedDtoClasses(dto)].sort()).toEqual(['Beta', 'Epsilon', 'User']);
    });

    it('should ignore a missing file', () => {
      expect([...collectNestedDtoClasses()]).toEqual([]);
    });
  });

  describe('addConstructorParameter', () => {
    const add = content => addConstructorParameter(content, 'AccountResource', 'UserIdCipher', 'userIdCipher');

    it('should add the parameter to a constructor written on a single line', () => {
      expect(add('    public AccountResource(MailService mailService) {')).toBe(
        '    public AccountResource(MailService mailService, UserIdCipher userIdCipher) {',
      );
    });

    it('should add the parameter to a constructor spread over several lines', () => {
      const content = [
        '    public AccountResource(',
        '        UserService userService,',
        '        MailService mailService',
        '    ) {',
      ].join('\n');
      const expected = [
        '    public AccountResource(',
        '        UserService userService,',
        '        MailService mailService, UserIdCipher userIdCipher',
        '    ) {',
      ].join('\n');

      expect(add(content)).toBe(expected);
    });

    it('should add the parameter to a constructor without parameters', () => {
      expect(add('    public AccountResource() {')).toBe('    public AccountResource(UserIdCipher userIdCipher) {');
    });

    it('should leave the constructor of another class alone', () => {
      expect(add('    public UserResource(MailService mailService) {')).toBe('    public UserResource(MailService mailService) {');
    });
  });

  describe('quoteObjectIds', () => {
    const encrypted = new Set(['Alpha', 'Beta', 'User']);
    const quote = content => quoteObjectIds(content, encrypted, 'Alpha');

    it('should quote the id of the entity the file belongs to', () => {
      expect(quote('const entity = {id: 123};')).toBe("const entity = {id: '123'};");
      expect(quote('  id: 12323};')).toBe("  id: '12323'};");
    });

    it('should quote the id of an encrypted relationship', () => {
      expect(quote('const beta : IBeta = {id: 9373};')).toBe("const beta : IBeta = {id: '9373'};");
      expect(quote('const users: IUser[] = [{id: 42}];')).toBe("const users: IUser[] = [{id: '42'}];");
    });

    it('should keep the id of a relationship that is not encrypted', () => {
      expect(quote('const zeta : IZeta = {id: 9373};')).toBe('const zeta : IZeta = {id: 9373};');
      expect(quote('const zetas: IZeta[] = [{id: 42}];')).toBe('const zetas: IZeta[] = [{id: 42}];');
    });

    it('should take the entity of a compare block from the name of the block', () => {
      const content = [
        "    describe('compareZeta', () => {",
        '      const entity = {id: 9373};',
        '    });',
        "    describe('compareBeta', () => {",
        '      const entity = {id: 42};',
        '    });',
      ].join('\n');
      const expected = [
        "    describe('compareZeta', () => {",
        '      const entity = {id: 9373};',
        '    });',
        "    describe('compareBeta', () => {",
        "      const entity = {id: '42'};",
        '    });',
      ].join('\n');

      expect(quote(content)).toBe(expected);
    });

    it('should not convert a field that only looks like the id', () => {
      expect(quote('  identifier: 123,')).toBe('  identifier: 123,');
      expect(quote('  counter: 7,')).toBe('  counter: 7,');
    });

    it('should not quote an id twice', () => {
      expect(quote("const entity = {id: '123'};")).toBe("const entity = {id: '123'};");
    });
  });
});
