<template>
  <div class="ai-card ai-card--table">
    <div class="ai-card__header" v-if="title">
      <span class="ai-card__icon">{{ icon || '📋' }}</span>
      <span class="ai-card__title">{{ title }}</span>
    </div>
    
    <div class="ai-table-wrapper">
      <table class="ai-table" v-if="rows?.length">
        <thead v-if="headers?.length">
          <tr>
            <th v-for="h in headers" :key="h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in rows" :key="idx">
            <td v-for="(cell, cidx) in row" :key="cidx">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="ai-table__empty">
        Нет данных
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  icon?: string;
  headers?: string[];
  rows: (string | number)[][];
}>();
</script>

<style scoped>
.ai-card--table {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid var(--color-border);
}

.ai-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ai-card__icon {
  font-size: 1.2rem;
}

.ai-card__title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.ai-table-wrapper {
  overflow-x: auto;
}

.ai-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.ai-table th,
.ai-table td {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  text-align: left;
}

.ai-table th {
  background: var(--color-surface-dim);
  font-weight: 600;
  font-size: 0.8rem;
}

.ai-table tr:nth-child(even) {
  background: var(--color-surface-dim);
}

.ai-table__empty {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 16px;
  font-size: 0.85rem;
}
</style>
