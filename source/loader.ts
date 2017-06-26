import {transformFile} from './transform';

module.exports = function(content: string) {
  if (typeof this.cacheable === 'function') {
    this.cacheable();
  }
  return transformFile('module.ts', content);
};