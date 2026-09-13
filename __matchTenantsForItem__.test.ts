import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchTenantsForItem,
} from './server/lib/connectors/pncp/PncpApiClient.js';
import type {
  TenantMatchRule,
  PncpRawItem,
} from './server/lib/connectors/pncp/types.js';

describe('matchTenantsForItem - Edge Cases & Multi-Match Support', () => {
  describe('Single Tenant Scenarios', () => {
    it('should match NCM and keyword for same tenant (no short-circuit)', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Esteira elétrica fitness',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: ['esteira', 'fitness'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].tenantId, 'tenant-1');

      const matchTypes = result[0].matches.map((m) => ({ type: m.type, value: m.value }));
      assert.ok(
        matchTypes.some((m) => m.type === 'NCM' && m.value === '9506.91'),
        'should contain NCM match',
      );
      assert.ok(
        matchTypes.some((m) => m.type === 'KEYWORD' && m.value === 'esteira'),
        'should contain esteira keyword match',
      );
      assert.ok(
        matchTypes.some((m) => m.type === 'KEYWORD' && m.value === 'fitness'),
        'should contain fitness keyword match',
      );
      assert.equal(result[0].matches.length, 3, 'should have 3 matches (NCM + 2 keywords)');
    });

    it('should match NCM only (no keywords in description)', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Equipment for gym',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-fitness',
          ncms: ['9506.91'],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches.length, 1);
      assert.equal(result[0].matches[0].type, 'NCM');
      assert.equal(result[0].matches[0].value, '9506.91');
    });

    it('should match keyword only (NCM not in rules)', () => {
      const item: PncpRawItem = {
        codigoNcm: '1234.56.78',
        objetoCompra: 'Equipment esteira fitness',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-sports',
          ncms: [],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches.length, 1);
      assert.equal(result[0].matches[0].type, 'KEYWORD');
      assert.equal(result[0].matches[0].value, 'esteira');
    });
  });

  describe('Multi-Tenant Scenarios', () => {
    it('should match multiple tenants independently', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Bola de basquete fitness',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-fitness',
          ncms: ['9506.91'],
          keywords: [],
        },
        {
          tenantId: 'tenant-sports',
          ncms: [],
          keywords: ['basquete', 'bola'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 2);

      const fitnessResult = result.find((r) => r.tenantId === 'tenant-fitness');
      assert.ok(fitnessResult, 'should have fitness tenant match');
      assert.equal(fitnessResult!.matches.length, 1);
      assert.equal(fitnessResult!.matches[0].type, 'NCM');
      assert.equal(fitnessResult!.matches[0].value, '9506.91');

      const sportsResult = result.find((r) => r.tenantId === 'tenant-sports');
      assert.ok(sportsResult, 'should have sports tenant match');
      assert.equal(sportsResult!.matches.length, 2);

      const sportsKeywords = sportsResult!.matches.map((m) => m.value);
      assert.ok(sportsKeywords.includes('basquete'), 'should contain basquete');
      assert.ok(sportsKeywords.includes('bola'), 'should contain bola');
    });

    it('should not match when no NCM or keyword hits', () => {
      const item: PncpRawItem = {
        codigoNcm: '1234.56.78',
        objetoCompra: 'Papel de impressora',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: ['fitness'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 0);
    });
  });

  describe('Deduplication & Edge Cases', () => {
    it('should deduplicate keywords appearing multiple times in description', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Fitness equipment for fitness training',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: [],
          keywords: ['fitness'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      // "fitness" appears twice in description, but should be counted only once
      const keywordMatches = result[0].matches.filter((m) => m.type === 'KEYWORD');
      assert.equal(keywordMatches.length, 1);
      assert.equal(keywordMatches[0].value, 'fitness');
    });

    it('should handle case-insensitive matching', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'ESTEIRA ELÉTRICA',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      const keywordMatches = result[0].matches.filter((m) => m.type === 'KEYWORD');
      assert.equal(keywordMatches.length, 1);
      assert.equal(keywordMatches[0].value, 'esteira');
    });

    it('should handle empty rules gracefully', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Esteira fitness',
      };
      const rules: TenantMatchRule[] = [];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 0);
    });

    it('should handle empty item fields gracefully', () => {
      const item: PncpRawItem = {
        codigoNcm: undefined,
        objetoCompra: undefined,
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: ['fitness'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 0, 'No match because NCM and keywords are empty');
    });

    it('should maintain order: results match order of rules', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Fitness equipment basquete',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-C',
          ncms: [],
          keywords: ['basquete'],
        },
        {
          tenantId: 'tenant-A',
          ncms: ['9506.91'],
          keywords: [],
        },
        {
          tenantId: 'tenant-B',
          ncms: [],
          keywords: ['equipment'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      // Order should match rules order: C, A, B
      const tenantIds = result.map((r) => r.tenantId);
      assert.deepEqual(tenantIds, ['tenant-C', 'tenant-A', 'tenant-B']);
    });
  });

  describe('Audit Trail Completeness', () => {
    it('should provide complete audit trail with all matched NCMs and keywords', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.50',
        objetoCompra: 'Esteira profissional e fitness',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-audit',
          ncms: ['9506.91', '9506.92'],
          keywords: ['esteira', 'fitness', 'profissional'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      const auditTrail = result[0].matches;

      // Should capture: 1 NCM match + 3 keyword matches
      assert.equal(auditTrail.length, 4);

      const ncmMatches = auditTrail.filter((m) => m.type === 'NCM');
      assert.equal(ncmMatches.length, 1);
      assert.equal(ncmMatches[0].value, '9506.91');

      const keywordMatches = auditTrail.filter((m) => m.type === 'KEYWORD');
      assert.equal(keywordMatches.length, 3);

      const keywordValues = keywordMatches.map((m) => m.value);
      assert.ok(keywordValues.includes('esteira'));
      assert.ok(keywordValues.includes('fitness'));
      assert.ok(keywordValues.includes('profissional'));
    });
  });

  describe('NCM Prefix Matching', () => {
    it('should match NCM when item NCM starts with rule NCM', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.50',
        objetoCompra: 'Some item',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: [],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches.length, 1);
      assert.equal(result[0].matches[0].value, '9506.91');
    });

    it('should not match NCM when item NCM does not start with rule NCM', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.92.50',
        objetoCompra: 'Some item',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: [],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 0);
    });

    it('should match multiple NCM rules for same tenant', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.92.50',
        objetoCompra: 'Some item',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91', '9506.92', '9506.93'],
          keywords: [],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches.length, 1);
      assert.equal(result[0].matches[0].value, '9506.92');
    });
  });

  describe('Keyword Matching', () => {
    it('should match partial keyword in description', () => {
      const item: PncpRawItem = {
        codigoNcm: '1234.56.78',
        objetoCompra: 'Produto com esteira de borracha',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: [],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches.length, 1);
      assert.equal(result[0].matches[0].value, 'esteira');
    });

    it('should not match keyword if not in description', () => {
      const item: PncpRawItem = {
        codigoNcm: '1234.56.78',
        objetoCompra: 'Produto de borracha',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: [],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 0);
    });
  });

  describe('Object vs objetoCompra field', () => {
    it('should use objeto field when objetoCompra is missing', () => {
      const item: PncpRawItem = {
        codigoNcm: '1234.56.78',
        objeto: 'Esteira de fitness',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: [],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches[0].value, 'esteira');
    });

    it('should prefer objetoCompra over objeto field', () => {
      const item: PncpRawItem = {
        codigoNcm: '1234.56.78',
        objetoCompra: 'Esteira de fitness',
        objeto: 'Outro produto',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: [],
          keywords: ['esteira'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches[0].value, 'esteira');
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should handle complex procurement item with multiple matches', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra:
          'Esteira elétrica para fitness com display digital e estabilizador',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-fitness-equipment',
          ncms: ['9506.91', '9506.92'],
          keywords: ['esteira', 'fitness', 'display'],
        },
        {
          tenantId: 'tenant-electronics',
          ncms: ['8517', '8526', '9004'],
          keywords: ['digital', 'display', 'eletrônico'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 2);

      const fitnessResult = result.find((r) => r.tenantId === 'tenant-fitness-equipment');
      assert.ok(fitnessResult);
      assert.equal(fitnessResult!.matches.length, 4); // 1 NCM + 3 keywords

      const electronicsResult = result.find((r) => r.tenantId === 'tenant-electronics');
      assert.ok(electronicsResult);
      assert.equal(electronicsResult!.matches.length, 2); // 2 keywords (digital, display)
    });

    it('should handle item with whitespace and special characters', () => {
      const item: PncpRawItem = {
        codigoNcm: '  9506.91.00  ',
        objetoCompra: '  Esteira  FITNESS  -  Equipamento  ',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: ['9506.91'],
          keywords: ['fitness'],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 1);
      assert.equal(result[0].matches.length, 2);
    });

    it('should handle rules with empty NCM and keyword arrays', () => {
      const item: PncpRawItem = {
        codigoNcm: '9506.91.00',
        objetoCompra: 'Some product',
      };
      const rules: TenantMatchRule[] = [
        {
          tenantId: 'tenant-1',
          ncms: [],
          keywords: [],
        },
      ];

      const result = matchTenantsForItem(item, rules);

      assert.equal(result.length, 0);
    });
  });
});
