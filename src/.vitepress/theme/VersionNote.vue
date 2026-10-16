<script setup>
// "Applies to ..." line at the top of each server and SRF page, from ../versions.json
import {computed} from 'vue';
import {useRoute} from 'vitepress';
import versions from '../versions.json';

const LINKS = {
  'drachtio-server': (v) => `https://github.com/drachtio/drachtio-server/tree/v${v}`,
  'drachtio-srf': (v) => `https://www.npmjs.com/package/drachtio-srf/v/${v}`,
};

const route = useRoute();
const project = computed(() => {
  if (/\/server\//.test(route.path)) return 'drachtio-server';
  if (/\/srf\//.test(route.path)) return 'drachtio-srf';
  return null;
});
</script>

<template>
  <p v-if="project" class="version-note">
    Applies to
    <a :href="LINKS[project](versions[project])" target="_blank" rel="noreferrer">
      {{ project }} {{ versions[project] }}
    </a>
  </p>
</template>

<style scoped>
.version-note {
  display: inline-block;
  margin: 0 0 16px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-default-soft);
}

.version-note a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
</style>
