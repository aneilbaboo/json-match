import {match} from './index';
import {expect} from 'chai';
import {isNumber} from 'util';

describe('match', function (){
  it('should succeed with a simple matching json pattern', function (){
    expect(match({a:1, b:2}, {b:2, a:1})).to.be.ok;
  });

  it('should fail if the pattern contains a key not present in the data',function() {
    expect(match({a:1, b:2, z:3}, {b:2, a:1})).to.not.be.ok;
  });

  it('should succeed if the pattern value is a function which will return truthy', function () {
    expect(match({a:isNumber, b:"hi"}, {b:"hi", a:1})).to.be.ok;
  });

  it('should fail if the pattern value is a function which will return falsey', function () {
    // console.log("********* START");
    expect(match({a:isNumber, b:2}, {b:2, a:"not a number"})).to.not.be.ok;
    // console.log("********* END");
  });

  it('should succeed a deep structure', function () {
    expect(match({a:1, b:{c:2, d:{ e: 3}}}, {b:{c:2, d:{ e: 3}}, a:1})).to.be.ok;
  });

  it('should fail to match a deep structure if the pattern has extra keys', function () {
    expect(match({a:1, b:{c:2, d:{ e: 3, f:4}}}, {b:{c:2, d:{ e: 3}}, a:1})).to.not.be.ok;
  });

  it('should succeed if the data value is greater than the $gt arg', function () {
    expect(match({a: {b: {$gt: 5}}}, {a: {b: 6}})).to.be.ok;
  });

  it('should fail if the data value is less than or equal to the $gt arg', function () {
    expect(match({a: {b: {$gt: 5}}}, {a: {b: 5}})).to.not.be.ok;
    expect(match({a: {b: {$gt: 5}}}, {a: {b: 4}})).to.not.be.ok;
  });

  it('should succeed if the data value is less than the $lt arg', function () {
    expect(match({a: {b: {$lt: 7}}}, {a: {b: 6}})).to.be.ok;
  });

  it('should fail if the data value is greater than or equal to the $lt arg', function () {
    expect(match({a: {b: {$lt: 5}}}, {a: {b: 5}})).to.not.be.ok;
    expect(match({a: {b: {$lt: 5}}}, {a: {b: 6}})).to.not.be.ok;
  });

  it('should succeed if the data value is less than or equal to the $lte arg', function () {
    expect(match({a: {b: {$lte: 5}}}, {a: {b: 5}})).to.be.ok;
    expect(match({a: {b: {$lte: 6}}}, {a: {b: 5}})).to.be.ok;
  });

  it('should fail if the data value is greater than the $lt arg', function () {
    expect(match({a: {b: {$lte: 4}}}, {a: {b: 5}})).to.not.be.ok;
  });

  it('should succeed if the data value is greater than or equal to the $gte arg', function () {
    expect(match({a: {b: {$gte: 5}}}, {a: {b: 6}})).to.be.ok;
    expect(match({a: {b: {$gte: 6}}}, {a: {b: 6}})).to.be.ok;
  });

  it('should fail if the data value is less than the $gte arg', function () {
    expect(match({a: {b: {$gte: 6}}}, {a: {b: 5}})).to.not.be.ok;
  });

  it('should succeed if $isNull finds data value is null', function () {
    expect(match({a: {b: {$isNull: true}}}, {a: {b: null}})).to.be.ok;
  });

  it('should fail if $isNull finds the data value is a non-null value, including other falsey values', function () {
    expect(match({a: {b: {$isNull: true}}}, {a: {b: false}})).to.not.be.ok;
    expect(match({a: {b: {$isNull: true}}}, {a: {b: 1}})).to.not.be.ok;
    expect(match({a: {b: {$isNull: true}}}, {a: {b: 0}})).to.not.be.ok;
    expect(match({a: {b: {$isNull: true}}}, {a: {b: true}})).to.not.be.ok;
  });


});
