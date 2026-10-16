import {h} from 'vue';
import DefaultTheme from 'vitepress/theme';
import VersionNote from './VersionNote.vue';
import HomeCode from './HomeCode.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'doc-before': () => h(VersionNote),
    'home-hero-image': () => h(HomeCode),
  }),
};
