import { describe, expect, it } from 'vitest';

import { collectNestedDtoClasses, quoteJsonIds } from './encrypt-id-util.js';

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

  describe('quoteJsonIds', () => {
    const encrypted = new Set(['Alpha', 'Beta', 'User']);

    it('should quote the id of an untyped fixture', () => {
      expect(quoteJsonIds('const entity = {"id":123};', encrypted)).toBe('const entity = {"id":"123"};');
    });

    it('should quote the id of an encrypted relationship', () => {
      expect(quoteJsonIds('const beta : IBeta = {"id":9373};', encrypted)).toBe('const beta : IBeta = {"id":"9373"};');
      expect(quoteJsonIds('const users: IUser[] = [{"id":42}];', encrypted)).toBe('const users: IUser[] = [{"id":"42"}];');
    });

    it('should keep the id of a relationship that is not encrypted', () => {
      expect(quoteJsonIds('const zeta : IZeta = {"id":9373};', encrypted)).toBe('const zeta : IZeta = {"id":9373};');
      expect(quoteJsonIds('const zetas: IZeta[] = [{"id":42}];', encrypted)).toBe('const zetas: IZeta[] = [{"id":42}];');
    });

    it('should handle encrypted and plain ids in the same file', () => {
      const content = ['const alpha : IAlpha = {"id":456};', 'const zeta : IZeta = {"id":9373};', 'const entity = {"id":123};'].join('\n');
      const expected = ['const alpha : IAlpha = {"id":"456"};', 'const zeta : IZeta = {"id":9373};', 'const entity = {"id":"123"};'].join(
        '\n',
      );

      expect(quoteJsonIds(content, encrypted)).toBe(expected);
    });

    it('should not quote an id twice', () => {
      expect(quoteJsonIds('const entity = {"id":"123"};', encrypted)).toBe('const entity = {"id":"123"};');
    });
  });
});
