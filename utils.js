import {isString, isArray} from 'util';//
// Results returned from tests
//
export function Capture(value, captures) {
  this.value = value;
  this.bindings = captures;
}

export function isCapture(o) {
  return o && o.constructor==Capture;
}

export function isSuccess(o) {
  return o!=undefined ? true : false;
}

export function pathToArray(path) { return isString(path) ? path.split('.') : path; }
export function pathToString(path) { return isArray(path) ? path.join('.') : path; }
export function pathIndex(path) { return path[path.length -1]; }
export function pathParent(path) { return path.slice(0, path.length -1); }

/**
 * alias - renames the keys in ops according to the mapping in aliases
 *
 * @param  {type} ops     an object mapping operator names to definitions
 * @param  {type} aliases a map of existing operator names to new operator names
 * @return {type}         returns a modified copy of ops
 */
export function alias(ops, aliases) {
  ops = {...ops}; // modify the copy
  for (var k in aliases) {
    var opvalue = ops[k];
    var alias = aliases[k];
    if (opvalue) {
      ops[alias] = opvalue;
      delete ops[k];
    }
  }
  return ops;
}
