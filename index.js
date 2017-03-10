import {Capture, isCapture, isSuccess, alias} from './utils';
import {evalPattern} from './evaluator';
import {
  DEFAULT_OPTIONS,
  DEFAULT_OPERATORS,
  DEFAULT_AGGREGATORS,
  DEFAULT_MACROS} from './ops';

export {DEFAULT_AGGREGATORS, DEFAULT_OPERATORS, DEFAULT_MACROS,
        Capture, isCapture};

/**
 * match - returns Su
 *
 * @param  {type} pattern description
 * @param  {type} data    description
 * @param  {type} options
 * @param  {boolean} options.first  if true (default) only match the first element of an array
 * @return {type}         returns has of captured values on success or null
 */
export function match(pattern, data, options) {
  options = {...DEFAULT_OPTIONS, ...(options || {})};
  var aliases = options.aliases;
  if (aliases) {
    options.ops = alias(options.ops, aliases);
    options.aggregators = alias(options.aggregators, aliases);
  }
  // // console.log('calling evalPattern with options: %j', options);
  var result = evalPattern([], pattern, data, options);
  if (isCapture(result)) {
    return result.bindings;
  } else if (isSuccess(result)) {
    return {};
  } else {
    return null; // no matches
  }
}
