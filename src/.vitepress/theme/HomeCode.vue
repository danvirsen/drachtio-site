<script setup>
// The code card shown next to the hero text on the home page.
import HomeCode from './home-code.md';
</script>

<template>
  <div class="home-code vp-doc">
    <div class="home-code-bar"><span></span><span></span><span></span></div>
    <HomeCode />
  </div>
</template>

<style scoped>
.home-code {
  width: 100%;
  min-width: 0;
  max-width: 520px;
  font-size: 13px;
  text-align: left;
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-code-block-bg);
  box-shadow: var(--vp-shadow-3);
}

.home-code-bar {
  display: flex;
  gap: 6px;
  padding: 12px 16px 0;
}

.home-code-bar span {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--vp-c-gray-1);
}

.home-code-bar span:first-child {
  background: var(--vp-c-brand-1);
}

.home-code :deep(div[class*='language-']) {
  margin: 0 !important;
  border-radius: 0 !important;
}

.home-code :deep(span.lang),
.home-code :deep(button.copy) {
  display: none;
}
</style>
