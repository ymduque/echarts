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

import * as zrUtil from 'zrender/src/core/util';
import Scale from './Scale';
import * as numberUtil from '../util/number';
import * as scaleHelper from './helper';

// Use some method of IntervalScale
import IntervalScale from './Interval';
import SeriesData from '../data/SeriesData';
import { DimensionName, ScaleTick } from '../util/types';

const scaleProto = Scale.prototype;
// FIXME:TS refactor: not good to call it directly with `this`?
const intervalScaleProto = IntervalScale.prototype;

const roundingErrorFix = numberUtil.round;

const mathPow = Math.pow;

const mathLog = Math.log;

const getLogTicks = (_extent: any, base: any, _interval: any) => {
  // Tornem a posar l'extent en format [num, num] (sense log).
  const start = _extent[0];
  if (start < 0) {
    _extent[0] = numberUtil.round(-mathPow(base, -start) + 1);
  }
  else {
    _extent[0] = numberUtil.round(mathPow(base, start) - 1);
  }

  const end = _extent[1];

  if (end < 0) {
    _extent[1] = numberUtil.round(-mathPow(base, -end) + 1);
  }
  else {
    _extent[1] = numberUtil.round(mathPow(base, end) - 1);
  }

  let ticks = [];
  let tick = _extent[0];

  while (tick < _extent[1]) {
    if (ticks.length !== 0) {
      tick = tick + _interval;
    }
    ticks.push(tick);
  }

  // Tornem a convertir els ticks en log(tick)
  ticks = zrUtil.map(
    ticks,
    function (tick) {
      if (tick < 0) {
        tick = -(mathLog(-tick + 1) / mathLog(base));
      }
      else {
        tick = mathLog(tick + 1) / mathLog(base);
      }
      return tick;
    },
    this
  );

  return ticks;
};

class LogScale extends Scale {
  static type = 'log';
  readonly type = 'log';

  base = 10;

  private _originalScale: IntervalScale = new IntervalScale();

  private _fixMin: boolean;
  private _fixMax: boolean;

  // FIXME:TS actually used by `IntervalScale`
  private _interval: number = 0;
  // FIXME:TS actually used by `IntervalScale`
  private _niceExtent: [number, number];

  /**
   * @param Whether expand the ticks to niced extent.
   */
  getTicks(): ScaleTick[] {
    const originalScale = this._originalScale;
    const extent = this._extent;
    const originalExtent = originalScale.getExtent();

    return zrUtil.map(
      getLogTicks(originalExtent, this.base, this._interval),
      function (val) {
        let powVal:any;
        if (val < 0) {
           powVal = numberUtil.round(-mathPow(this.base, -val) + 1);
        }
        else {
           powVal = numberUtil.round(mathPow(this.base, val) - 1);
        }
        // Fix #4158
        powVal =
          val === extent[0] && this._fixMin
            ? fixRoundingError(powVal, originalExtent[0])
            : powVal;
        powVal =
          val === extent[1] && this._fixMax
            ? fixRoundingError(powVal, originalExtent[1])
            : powVal;

        return {
          value: powVal
        };
      },
      this
    );
  }

  setExtent(start: number, end: number): void {
    const base = this.base;
    // log(-Infinity) is NaN, so safe guard here
    if (start < 0) {
      start = -(mathLog(-start + 1) / mathLog(base));
    }
    else {
      start = mathLog(start + 1) / mathLog(base);
    }
    if (end < 0) {
      end = -(mathLog(-end + 1) / mathLog(base));
    }
    else {
      end = mathLog(end + 1) / mathLog(base);
    }
    this._originalScale.setExtent(start, end);
    intervalScaleProto.setExtent.call(this, start, end);
  }

  /**
   * @return {number} end
   */
  getExtent() {
    const base = this.base;
    const extent = scaleProto.getExtent.call(this);
    extent[0] = mathPow(base, extent[0]);
    extent[1] = mathPow(base, extent[1]);

    // Fix #4158
    const originalScale = this._originalScale;
    const originalExtent = originalScale.getExtent();
     // @ts-ignore
    originalExtent._fixMin && (extent[0] = fixRoundingError(extent[0], originalExtent[0]));
     // @ts-ignore
    originalExtent._fixMax && (extent[1] = fixRoundingError(extent[1], originalExtent[1]));

    return extent;
  }

  unionExtent(extent: [number, number]): void {
    this._originalScale.unionExtent(extent);

    const base = this.base;
    if (extent[0] < 0) {
      extent[0] = -(mathLog(-extent[0]) / mathLog(base));
    }
    else {
      extent[0] = mathLog(extent[0]) / mathLog(base);
    }
    if (extent[1] < 0) {
      extent[1] = -(mathLog(-extent[1]) / mathLog(base));
    }
    else {
      extent[1] = mathLog(extent[1]) / mathLog(base);
    }
    scaleProto.unionExtent.call(this, extent);
  }

  unionExtentFromData(data: SeriesData, dim: DimensionName): void {
    // TODO
    // filter value that <= 0
    this.unionExtent(data.getApproximateExtent(dim));
  }

  /**
   * Update interval and extent of intervals for nice ticks
   * @param approxTickNum default 10 Given approx tick number
   */
  calcNiceTicks(approxTickNum: number): void {
    approxTickNum = approxTickNum || 10;
    const extent = this._extent;
    const span = extent[1] - extent[0];
    if (span === Infinity || span <= 0) {
      return;
    }

    let interval = numberUtil.quantity(span);
    const err = (approxTickNum / span) * interval;

    // Filter ticks to get closer to the desired count.
    if (err <= 0.5) {
      interval *= 10;
    }

    // Interval should be integer
    while (
      !isNaN(interval) && Math.abs(interval) < 1 && Math.abs(interval) > 0
    ) {
      interval *= 10;
    }

    const niceExtent = [
      // numberUtil.round(mathCeil(extent[0] / interval) * interval),
      // numberUtil.round(mathFloor(extent[1] / interval) * interval),
      extent[0],
      extent[1]
    ] as [number, number];

    this._interval = interval;
    this._niceExtent = niceExtent;
  }

  calcNiceExtent(opt: {
    splitNumber: number; // By default 5.
    fixMin?: boolean;
    fixMax?: boolean;
    minInterval?: number;
    maxInterval?: number;
  }): void {
    intervalScaleProto.calcNiceExtent.call(this, opt);

    const originalScale = this._originalScale;
    // @ts-ignore
    originalScale.__fixMin = opt.fixMin;
    // @ts-ignore
    originalScale.__fixMax = opt.fixMax;
  }

  parse(val: any): number {
    return val;
  }

  contain(val: number): boolean {
    val = mathLog(val) / mathLog(this.base);
    return scaleHelper.contain(val, this._extent);
  }

  normalize(val: number): number {
    val = mathLog(val) / mathLog(this.base);
    return scaleHelper.normalize(val, this._extent);
  }

  scale(val: number): number {
    val = scaleHelper.scale(val, this._extent);
    return mathPow(this.base, val);
  }

  getMinorTicks: IntervalScale['getMinorTicks'];
  getLabel: IntervalScale['getLabel'];
}

const proto = LogScale.prototype;
proto.getMinorTicks = intervalScaleProto.getMinorTicks;
proto.getLabel = intervalScaleProto.getLabel;

function fixRoundingError(val: number, originalVal: number): number {
  return roundingErrorFix(val, numberUtil.getPrecision(originalVal));
}

zrUtil.each(['contain', 'normalize'], function (methodName: string) {
  // @ts-ignore
  LogScale.prototype[methodName] = function (val: any) {
      if (val < 0) {
          val = -(mathLog(-val + 1) / mathLog(this.base));
      }
      else {
          val = mathLog(val + 1) / mathLog(this.base);
      }
      // @ts-ignore
      return this._originalScale[methodName].call(this, val);
  };
});

Scale.registerClass(LogScale);

export default LogScale;
