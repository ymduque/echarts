
/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/


/**
 * AUTO-GENERATED FILE. DO NOT MODIFY.
 */

/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var _this = this;

import { __extends } from "tslib";
import * as zrUtil from 'zrender/lib/core/util.js';
import Scale from './Scale.js';
import * as numberUtil from '../util/number.js';
import * as scaleHelper from './helper.js'; // Use some method of IntervalScale

import IntervalScale from './Interval.js';
var scaleProto = Scale.prototype; // FIXME:TS refactor: not good to call it directly with `this`?

var intervalScaleProto = IntervalScale.prototype;
var roundingErrorFix = numberUtil.round;
var mathPow = Math.pow;
var mathLog = Math.log;

var getLogTicks = function (_extent, base, _interval) {
  // Tornem a posar l'extent en format [num, num] (sense log).
  var start = _extent[0];

  if (start < 0) {
    _extent[0] = numberUtil.round(-mathPow(base, -start) + 1);
  } else {
    _extent[0] = numberUtil.round(mathPow(base, start) - 1);
  }

  var end = _extent[1];

  if (end < 0) {
    _extent[1] = numberUtil.round(-mathPow(base, -end) + 1);
  } else {
    _extent[1] = numberUtil.round(mathPow(base, end) - 1);
  }

  var ticks = [];
  var tick = _extent[0];

  while (tick < _extent[1]) {
    if (ticks.length !== 0) {
      tick = tick + _interval;
    }

    ticks.push(tick);
  } // Tornem a convertir els ticks en log(tick)


  ticks = zrUtil.map(ticks, function (tick) {
    if (tick < 0) {
      tick = -(mathLog(-tick + 1) / mathLog(base));
    } else {
      tick = mathLog(tick + 1) / mathLog(base);
    }

    return tick;
  }, _this);
  return ticks;
};

var LogScale =
/** @class */
function (_super) {
  __extends(LogScale, _super);

  function LogScale() {
    var _this = _super !== null && _super.apply(this, arguments) || this;

    _this.type = 'log';
    _this.base = 10;
    _this._originalScale = new IntervalScale(); // FIXME:TS actually used by `IntervalScale`

    _this._interval = 0;
    return _this;
  }

  LogScale.prototype.getTicks = function () {
    // const originalScale = this._originalScale;
    var extent = this._extent; // const originalExtent = originalScale.getExtent();

    return zrUtil.map(getLogTicks(this._originalScale.getExtent(), this.base, this._interval), function (val) {
      var powVal;

      if (val < 0) {
        powVal = numberUtil.round(-mathPow(this.base, -val) + 1);
      } else {
        powVal = numberUtil.round(mathPow(this.base, val) - 1);
      } // Fix #4158


      powVal = val === extent[0] && this._fixMin ? fixRoundingError(powVal, this._originalScale.getExtent()[0]) : powVal;
      powVal = val === extent[1] && this._fixMax ? fixRoundingError(powVal, this._originalScale.getExtent()[1]) : powVal;
      return {
        value: powVal
      };
    }, this);
  };

  LogScale.prototype.setExtent = function (start, end) {
    var base = this.base; // log(-Infinity) is NaN, so safe guard here

    if (start < 0) {
      start = -(mathLog(-start + 1) / mathLog(base));
    } else {
      start = mathLog(start + 1) / mathLog(base);
    }

    if (end < 0) {
      end = -(mathLog(-end + 1) / mathLog(base));
    } else {
      end = mathLog(end + 1) / mathLog(base);
    }

    this._originalScale.setExtent(start, end);

    intervalScaleProto.setExtent.call(this, start, end);
  };
  /**
   * @return {number} end
   */


  LogScale.prototype.getExtent = function () {
    var base = this.base;
    var extent = scaleProto.getExtent.call(this);
    extent[0] = mathPow(base, extent[0]);
    extent[1] = mathPow(base, extent[1]); // Fix #4158

    var originalScale = this._originalScale;
    var originalExtent = originalScale.getExtent(); // @ts-ignore

    originalExtent._fixMin && (extent[0] = fixRoundingError(extent[0], originalExtent[0])); // @ts-ignore

    originalExtent._fixMax && (extent[1] = fixRoundingError(extent[1], originalExtent[1]));
    return extent;
  };

  LogScale.prototype.unionExtent = function (extent) {
    this._originalScale.unionExtent(extent);

    var base = this.base;

    if (extent[0] < 0) {
      extent[0] = -(mathLog(-extent[0]) / mathLog(base));
    } else {
      extent[0] = mathLog(extent[0]) / mathLog(base);
    }

    if (extent[1] < 0) {
      extent[1] = -(mathLog(-extent[1]) / mathLog(base));
    } else {
      extent[1] = mathLog(extent[1]) / mathLog(base);
    }

    scaleProto.unionExtent.call(this, extent);
  };

  LogScale.prototype.unionExtentFromData = function (data, dim) {
    // TODO
    // filter value that <= 0
    this.unionExtent(data.getApproximateExtent(dim));
  };
  /**
   * Update interval and extent of intervals for nice ticks
   * @param approxTickNum default 10 Given approx tick number
   */


  LogScale.prototype.calcNiceTicks = function (approxTickNum) {
    approxTickNum = approxTickNum || 10;
    var extent = this._extent;
    var span = extent[1] - extent[0];

    if (span === Infinity || span <= 0) {
      return;
    }

    var interval = numberUtil.quantity(span);
    var err = approxTickNum / span * interval; // Filter ticks to get closer to the desired count.

    if (err <= 0.5) {
      interval *= 10;
    } // Interval should be integer


    while (!isNaN(interval) && Math.abs(interval) < 1 && Math.abs(interval) > 0) {
      interval *= 10;
    }

    var niceExtent = [// numberUtil.round(mathCeil(extent[0] / interval) * interval),
    // numberUtil.round(mathFloor(extent[1] / interval) * interval),
    extent[0], extent[1]];
    this._interval = interval;
    this._niceExtent = niceExtent;
  };

  LogScale.prototype.calcNiceExtent = function (opt) {
    intervalScaleProto.calcNiceExtent.call(this, opt);
    var originalScale = this._originalScale; // @ts-ignore

    originalScale.__fixMin = opt.fixMin; // @ts-ignore

    originalScale.__fixMax = opt.fixMax;
  };

  LogScale.prototype.parse = function (val) {
    return val;
  };

  LogScale.prototype.contain = function (val) {
    val = mathLog(val) / mathLog(this.base);
    return scaleHelper.contain(val, this._extent);
  };

  LogScale.prototype.normalize = function (val) {
    val = mathLog(val) / mathLog(this.base);
    return scaleHelper.normalize(val, this._extent);
  };

  LogScale.prototype.scale = function (val) {
    val = scaleHelper.scale(val, this._extent);
    return mathPow(this.base, val);
  };

  LogScale.type = 'log';
  return LogScale;
}(Scale);

var proto = LogScale.prototype;
proto.getMinorTicks = intervalScaleProto.getMinorTicks;
proto.getLabel = intervalScaleProto.getLabel;

function fixRoundingError(val, originalVal) {
  return roundingErrorFix(val, numberUtil.getPrecision(originalVal));
}

zrUtil.each(['contain', 'normalize'], function (methodName) {
  // @ts-ignore
  LogScale.prototype[methodName] = function (val) {
    if (val < 0) {
      val = -(mathLog(-val + 1) / mathLog(this.base));
    } else {
      val = mathLog(val + 1) / mathLog(this.base);
    } // @ts-ignore


    return this._originalScale[methodName].call(this, val);
  };
});
Scale.registerClass(LogScale);
export default LogScale;