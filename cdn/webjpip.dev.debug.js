/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* This class implements the QM Coder decoding as defined in
 *   JPEG 2000 Part I Final Committee Draft Version 1.0
 *   Annex C.3 Arithmetic decoding procedure 
 * available at http://www.jpeg.org/public/fcd15444-1.pdf
 * 
 * The arithmetic decoder is used in conjunction with context models to decode
 * JPEG2000 and JBIG2 streams.
 */
var ArithmeticDecoder = (function ArithmeticDecoderClosure() {
  // Table C-2
  var QeTable = [
    {qe: 0x5601, nmps: 1, nlps: 1, switchFlag: 1},
    {qe: 0x3401, nmps: 2, nlps: 6, switchFlag: 0},
    {qe: 0x1801, nmps: 3, nlps: 9, switchFlag: 0},
    {qe: 0x0AC1, nmps: 4, nlps: 12, switchFlag: 0},
    {qe: 0x0521, nmps: 5, nlps: 29, switchFlag: 0},
    {qe: 0x0221, nmps: 38, nlps: 33, switchFlag: 0},
    {qe: 0x5601, nmps: 7, nlps: 6, switchFlag: 1},
    {qe: 0x5401, nmps: 8, nlps: 14, switchFlag: 0},
    {qe: 0x4801, nmps: 9, nlps: 14, switchFlag: 0},
    {qe: 0x3801, nmps: 10, nlps: 14, switchFlag: 0},
    {qe: 0x3001, nmps: 11, nlps: 17, switchFlag: 0},
    {qe: 0x2401, nmps: 12, nlps: 18, switchFlag: 0},
    {qe: 0x1C01, nmps: 13, nlps: 20, switchFlag: 0},
    {qe: 0x1601, nmps: 29, nlps: 21, switchFlag: 0},
    {qe: 0x5601, nmps: 15, nlps: 14, switchFlag: 1},
    {qe: 0x5401, nmps: 16, nlps: 14, switchFlag: 0},
    {qe: 0x5101, nmps: 17, nlps: 15, switchFlag: 0},
    {qe: 0x4801, nmps: 18, nlps: 16, switchFlag: 0},
    {qe: 0x3801, nmps: 19, nlps: 17, switchFlag: 0},
    {qe: 0x3401, nmps: 20, nlps: 18, switchFlag: 0},
    {qe: 0x3001, nmps: 21, nlps: 19, switchFlag: 0},
    {qe: 0x2801, nmps: 22, nlps: 19, switchFlag: 0},
    {qe: 0x2401, nmps: 23, nlps: 20, switchFlag: 0},
    {qe: 0x2201, nmps: 24, nlps: 21, switchFlag: 0},
    {qe: 0x1C01, nmps: 25, nlps: 22, switchFlag: 0},
    {qe: 0x1801, nmps: 26, nlps: 23, switchFlag: 0},
    {qe: 0x1601, nmps: 27, nlps: 24, switchFlag: 0},
    {qe: 0x1401, nmps: 28, nlps: 25, switchFlag: 0},
    {qe: 0x1201, nmps: 29, nlps: 26, switchFlag: 0},
    {qe: 0x1101, nmps: 30, nlps: 27, switchFlag: 0},
    {qe: 0x0AC1, nmps: 31, nlps: 28, switchFlag: 0},
    {qe: 0x09C1, nmps: 32, nlps: 29, switchFlag: 0},
    {qe: 0x08A1, nmps: 33, nlps: 30, switchFlag: 0},
    {qe: 0x0521, nmps: 34, nlps: 31, switchFlag: 0},
    {qe: 0x0441, nmps: 35, nlps: 32, switchFlag: 0},
    {qe: 0x02A1, nmps: 36, nlps: 33, switchFlag: 0},
    {qe: 0x0221, nmps: 37, nlps: 34, switchFlag: 0},
    {qe: 0x0141, nmps: 38, nlps: 35, switchFlag: 0},
    {qe: 0x0111, nmps: 39, nlps: 36, switchFlag: 0},
    {qe: 0x0085, nmps: 40, nlps: 37, switchFlag: 0},
    {qe: 0x0049, nmps: 41, nlps: 38, switchFlag: 0},
    {qe: 0x0025, nmps: 42, nlps: 39, switchFlag: 0},
    {qe: 0x0015, nmps: 43, nlps: 40, switchFlag: 0},
    {qe: 0x0009, nmps: 44, nlps: 41, switchFlag: 0},
    {qe: 0x0005, nmps: 45, nlps: 42, switchFlag: 0},
    {qe: 0x0001, nmps: 45, nlps: 43, switchFlag: 0},
    {qe: 0x5601, nmps: 46, nlps: 46, switchFlag: 0}
  ];

  // C.3.5 Initialisation of the decoder (INITDEC)
  function ArithmeticDecoder(data, start, end) {
    this.data = data;
    this.bp = start;
    this.dataEnd = end;

    this.chigh = data[start];
    this.clow = 0;

    this.byteIn();

    this.chigh = ((this.chigh << 7) & 0xFFFF) | ((this.clow >> 9) & 0x7F);
    this.clow = (this.clow << 7) & 0xFFFF;
    this.ct -= 7;
    this.a = 0x8000;
  }

  ArithmeticDecoder.prototype = {
    // C.3.4 Compressed data input (BYTEIN)
    byteIn: function ArithmeticDecoder_byteIn() {
      var data = this.data;
      var bp = this.bp;
      if (data[bp] === 0xFF) {
        var b1 = data[bp + 1];
        if (b1 > 0x8F) {
          this.clow += 0xFF00;
          this.ct = 8;
        } else {
          bp++;
          this.clow += (data[bp] << 9);
          this.ct = 7;
          this.bp = bp;
        }
      } else {
        bp++;
        this.clow += bp < this.dataEnd ? (data[bp] << 8) : 0xFF00;
        this.ct = 8;
        this.bp = bp;
      }
      if (this.clow > 0xFFFF) {
        this.chigh += (this.clow >> 16);
        this.clow &= 0xFFFF;
      }
    },
    // C.3.2 Decoding a decision (DECODE)
    readBit: function ArithmeticDecoder_readBit(contexts, pos) {
      // contexts are packed into 1 byte:
      // highest 7 bits carry cx.index, lowest bit carries cx.mps
      var cx_index = contexts[pos] >> 1, cx_mps = contexts[pos] & 1;
      var qeTableIcx = QeTable[cx_index];
      var qeIcx = qeTableIcx.qe;
      var d;
      var a = this.a - qeIcx;

      if (this.chigh < qeIcx) {
        // exchangeLps
        if (a < qeIcx) {
          a = qeIcx;
          d = cx_mps;
          cx_index = qeTableIcx.nmps;
        } else {
          a = qeIcx;
          d = 1 ^ cx_mps;
          if (qeTableIcx.switchFlag === 1) {
            cx_mps = d;
          }
          cx_index = qeTableIcx.nlps;
        }
      } else {
        this.chigh -= qeIcx;
        if ((a & 0x8000) !== 0) {
          this.a = a;
          return cx_mps;
        }
        // exchangeMps
        if (a < qeIcx) {
          d = 1 ^ cx_mps;
          if (qeTableIcx.switchFlag === 1) {
            cx_mps = d;
          }
          cx_index = qeTableIcx.nlps;
        } else {
          d = cx_mps;
          cx_index = qeTableIcx.nmps;
        }
      }
      // C.3.3 renormD;
      do {
        if (this.ct === 0) {
          this.byteIn();
        }

        a <<= 1;
        this.chigh = ((this.chigh << 1) & 0xFFFF) | ((this.clow >> 15) & 1);
        this.clow = (this.clow << 1) & 0xFFFF;
        this.ct--;
      } while ((a & 0x8000) === 0);
      this.a = a;

      contexts[pos] = cx_index << 1 | cx_mps;
      return d;
    }
  };

  return ArithmeticDecoder;
})();

/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals ArithmeticDecoder, globalScope, log2, readUint16, readUint32,
           info, warn */

'use strict';

var JpxImage = (function JpxImageClosure() {
  // Table E.1
  var SubbandsGainLog2 = {
    'LL': 0,
    'LH': 1,
    'HL': 1,
    'HH': 2
  };
  function JpxImage() {
    this.failOnCorruptedImage = false;
  }
  JpxImage.prototype = {
    parse: function JpxImage_parse(data) {

      var head = readUint16(data, 0);
      // No box header, immediate start of codestream (SOC)
      if (head === 0xFF4F) {
        this.parseCodestream(data, 0, data.length);
        return;
      }

      var position = 0, length = data.length;
      while (position < length) {
        var headerSize = 8;
        var lbox = readUint32(data, position);
        var tbox = readUint32(data, position + 4);
        position += headerSize;
        if (lbox === 1) {
          // XLBox: read UInt64 according to spec.
          // JavaScript's int precision of 53 bit should be sufficient here.
          lbox = readUint32(data, position) * 4294967296 +
                 readUint32(data, position + 4);
          position += 8;
          headerSize += 8;
        }
        if (lbox === 0) {
          lbox = length - position + headerSize;
        }
        if (lbox < headerSize) {
          throw new Error('JPX Error: Invalid box field size');
        }
        var dataLength = lbox - headerSize;
        var jumpDataLength = true;
        switch (tbox) {
          case 0x6A703268: // 'jp2h'
            jumpDataLength = false; // parsing child boxes
            break;
          case 0x636F6C72: // 'colr'
            // Colorspaces are not used, the CS from the PDF is used.
            var method = data[position];
            var precedence = data[position + 1];
            var approximation = data[position + 2];
            if (method === 1) {
              // enumerated colorspace
              var colorspace = readUint32(data, position + 3);
              switch (colorspace) {
                case 16: // this indicates a sRGB colorspace
                case 17: // this indicates a grayscale colorspace
                case 18: // this indicates a YUV colorspace
                  break;
                default:
                  warn('Unknown colorspace ' + colorspace);
                  break;
              }
            } else if (method === 2) {
              info('ICC profile not supported');
            }
            break;
          case 0x6A703263: // 'jp2c'
            this.parseCodestream(data, position, position + dataLength);
            break;
          case 0x6A502020: // 'jP\024\024'
            if (0x0d0a870a !== readUint32(data, position)) {
              warn('Invalid JP2 signature');
            }
            break;
          // The following header types are valid but currently not used:
          case 0x6A501A1A: // 'jP\032\032'
          case 0x66747970: // 'ftyp'
          case 0x72726571: // 'rreq'
          case 0x72657320: // 'res '
          case 0x69686472: // 'ihdr'
            break;
          default:
            var headerType = String.fromCharCode((tbox >> 24) & 0xFF,
                                                 (tbox >> 16) & 0xFF,
                                                 (tbox >> 8) & 0xFF,
                                                 tbox & 0xFF);
            warn('Unsupported header type ' + tbox + ' (' + headerType + ')');
            break;
        }
        if (jumpDataLength) {
          position += dataLength;
        }
      }
    },
    parseImageProperties: function JpxImage_parseImageProperties(stream) {
      var newByte = stream.getByte();
      while (newByte >= 0) {
        var oldByte = newByte;
        newByte = stream.getByte();
        var code = (oldByte << 8) | newByte;
        // Image and tile size (SIZ)
        if (code === 0xFF51) {
          stream.skip(4);
          var Xsiz = stream.getInt32() >>> 0; // Byte 4
          var Ysiz = stream.getInt32() >>> 0; // Byte 8
          var XOsiz = stream.getInt32() >>> 0; // Byte 12
          var YOsiz = stream.getInt32() >>> 0; // Byte 16
          stream.skip(16);
          var Csiz = stream.getUint16(); // Byte 36
          this.width = Xsiz - XOsiz;
          this.height = Ysiz - YOsiz;
          this.componentsCount = Csiz;
          // Results are always returned as Uint8Arrays
          this.bitsPerComponent = 8;
          return;
        }
      }
      throw new Error('JPX Error: No size marker found in JPX stream');
    },
    parseCodestream: function JpxImage_parseCodestream(
      data, start, end, options) {
      var context = {};
      options = options || {};
      var isOnlyParseHeaders = !!options.isOnlyParseHeaders;
      var regionToParse = options.regionToParse;
      if (regionToParse !== undefined && isOnlyParseHeaders) {
        throw 'JPX Error: options.regionToParse is uneffective if ' +
          'options.isOnlyParseHeaders = true';
      }
      
      try {
        var doNotRecover = false;
        var position = start;
        while (position + 1 < end) {
          var code = readUint16(data, position);
          position += 2;

          var length = 0, j, sqcd, spqcds, spqcdSize, scalarExpounded, tile;
          switch (code) {
            case 0xFF4F: // Start of codestream (SOC)
              context.mainHeader = true;
              break;
            case 0xFFD9: // End of codestream (EOC)
              break;
            case 0xFF51: // Image and tile size (SIZ)
              length = readUint16(data, position);
              var siz = {};
              siz.Xsiz = readUint32(data, position + 4);
              siz.Ysiz = readUint32(data, position + 8);
              siz.XOsiz = readUint32(data, position + 12);
              siz.YOsiz = readUint32(data, position + 16);
              siz.XTsiz = readUint32(data, position + 20);
              siz.YTsiz = readUint32(data, position + 24);
              siz.XTOsiz = readUint32(data, position + 28);
              siz.YTOsiz = readUint32(data, position + 32);
              var componentsCount = readUint16(data, position + 36);
              siz.Csiz = componentsCount;
              var components = [];
              var isComponentSizesSupported = true;
              j = position + 38;
              for (var i = 0; i < componentsCount; i++) {
                var component = {
                  precision: (data[j] & 0x7F) + 1,
                  isSigned: !!(data[j] & 0x80),
                  XRsiz: data[j + 1],
                  YRsiz: data[j + 1]
                };
                calculateComponentDimensions(component, siz);
                components.push(component);
                
                if (regionToParse !== undefined) {
                  isComponentSizesSupported &=
                    component.XRsiz === 1 && component.YRsiz === 1;
                }
              }
              context.SIZ = siz;
              context.components = components;
              calculateTileGrids(context, components);
              context.QCC = [];
              context.COC = [];
              
              if (!isComponentSizesSupported) {
                throw new Error('JPX Error: When regionToParse is used, ' +
                  'component size other than 1 is not supported');
              }
              break;
            case 0xFF55: // Tile-part lengths, main header (TLM)
              var Ltlm = readUint16(data, position); // Marker segment length
              // Skip tile length markers
              position += Ltlm;
              break;
            case 0xFF58: // Packet lengths, tile header (PLT): MAMAZAV
              var Lplt = readUint16(data, position); // Marker segment length
              // Skip tile length markers
              position += Lplt;
              break;
            case 0xFF5C: // Quantization default (QCD)
              length = readUint16(data, position);
              var qcd = {};
              j = position + 2;
              sqcd = data[j++];
              switch (sqcd & 0x1F) {
                case 0:
                  spqcdSize = 8;
                  scalarExpounded = true;
                  break;
                case 1:
                  spqcdSize = 16;
                  scalarExpounded = false;
                  break;
                case 2:
                  spqcdSize = 16;
                  scalarExpounded = true;
                  break;
                default:
                  throw new Error('JPX Error: Invalid SQcd value ' + sqcd);
              }
              qcd.noQuantization = (spqcdSize === 8);
              qcd.scalarExpounded = scalarExpounded;
              qcd.guardBits = sqcd >> 5;
              spqcds = [];
              while (j < length + position) {
                var spqcd = {};
                if (spqcdSize === 8) {
                  spqcd.epsilon = data[j++] >> 3;
                  spqcd.mu = 0;
                } else {
                  spqcd.epsilon = data[j] >> 3;
                  spqcd.mu = ((data[j] & 0x7) << 8) | data[j + 1];
                  j += 2;
                }
                spqcds.push(spqcd);
              }
              qcd.SPqcds = spqcds;
              if (context.mainHeader) {
                context.QCD = qcd;
              } else {
                context.currentTile.QCD = qcd;
                context.currentTile.QCC = [];
              }
              break;
            case 0xFF5D: // Quantization component (QCC)
              length = readUint16(data, position);
              var qcc = {};
              j = position + 2;
              var cqcc;
              if (context.SIZ.Csiz < 257) {
                cqcc = data[j++];
              } else {
                cqcc = readUint16(data, j);
                j += 2;
              }
              sqcd = data[j++];
              switch (sqcd & 0x1F) {
                case 0:
                  spqcdSize = 8;
                  scalarExpounded = true;
                  break;
                case 1:
                  spqcdSize = 16;
                  scalarExpounded = false;
                  break;
                case 2:
                  spqcdSize = 16;
                  scalarExpounded = true;
                  break;
                default:
                  throw new Error('JPX Error: Invalid SQcd value ' + sqcd);
              }
              qcc.noQuantization = (spqcdSize === 8);
              qcc.scalarExpounded = scalarExpounded;
              qcc.guardBits = sqcd >> 5;
              spqcds = [];
              while (j < (length + position)) {
                spqcd = {};
                if (spqcdSize === 8) {
                  spqcd.epsilon = data[j++] >> 3;
                  spqcd.mu = 0;
                } else {
                  spqcd.epsilon = data[j] >> 3;
                  spqcd.mu = ((data[j] & 0x7) << 8) | data[j + 1];
                  j += 2;
                }
                spqcds.push(spqcd);
              }
              qcc.SPqcds = spqcds;
              if (context.mainHeader) {
                context.QCC[cqcc] = qcc;
              } else {
                context.currentTile.QCC[cqcc] = qcc;
              }
              break;
            case 0xFF52: // Coding style default (COD)
              length = readUint16(data, position);
              var cod = {};
              j = position + 2;
              var scod = data[j++];
              cod.entropyCoderWithCustomPrecincts = !!(scod & 1);
              cod.sopMarkerUsed = !!(scod & 2);
              cod.ephMarkerUsed = !!(scod & 4);
              cod.progressionOrder = data[j++];
              cod.layersCount = readUint16(data, j);
              j += 2;
              cod.multipleComponentTransform = data[j++];

              cod.decompositionLevelsCount = data[j++];
              cod.xcb = (data[j++] & 0xF) + 2;
              cod.ycb = (data[j++] & 0xF) + 2;
              var blockStyle = data[j++];
              cod.selectiveArithmeticCodingBypass = !!(blockStyle & 1);
              cod.resetContextProbabilities = !!(blockStyle & 2);
              cod.terminationOnEachCodingPass = !!(blockStyle & 4);
              cod.verticalyStripe = !!(blockStyle & 8);
              cod.predictableTermination = !!(blockStyle & 16);
              cod.segmentationSymbolUsed = !!(blockStyle & 32);
              cod.reversibleTransformation = data[j++];
              if (cod.entropyCoderWithCustomPrecincts) {
                var precinctsSizes = [];
                while (j < length + position) {
                  var precinctsSize = data[j++];
                  precinctsSizes.push({
                    PPx: precinctsSize & 0xF,
                    PPy: precinctsSize >> 4
                  });
                }
                cod.precinctsSizes = precinctsSizes;
              }
              var unsupported = [];
              if (cod.selectiveArithmeticCodingBypass) {
                unsupported.push('selectiveArithmeticCodingBypass');
              }
              if (cod.resetContextProbabilities) {
                unsupported.push('resetContextProbabilities');
              }
              if (cod.terminationOnEachCodingPass) {
                unsupported.push('terminationOnEachCodingPass');
              }
              if (cod.verticalyStripe) {
                unsupported.push('verticalyStripe');
              }
              if (cod.predictableTermination) {
                unsupported.push('predictableTermination');
              }
              if (unsupported.length > 0) {
                doNotRecover = true;
                throw new Error('JPX Error: Unsupported COD options (' +
                                unsupported.join(', ') + ')');
              }
              if (context.mainHeader) {
                context.COD = cod;
              } else {
                context.currentTile.COD = cod;
                context.currentTile.COC = [];
              }
              break;
            case 0xFF90: // Start of tile-part (SOT)
              length = readUint16(data, position);
              tile = {};
              tile.index = readUint16(data, position + 2);
              tile.length = readUint32(data, position + 4);
              tile.dataEnd = tile.length + position - 2;
              tile.partIndex = data[position + 8];
              tile.partsCount = data[position + 9];

              context.mainHeader = false;
              if (tile.partIndex === 0) {
                // reset component specific settings
                tile.COD = context.COD;
                tile.COC = context.COC.slice(0); // clone of the global COC
                tile.QCD = context.QCD;
                tile.QCC = context.QCC.slice(0); // clone of the global COC
              }
              context.currentTile = tile;
              break;
            case 0xFF93: // Start of data (SOD)
              tile = context.currentTile;
              if (tile.partIndex === 0) {
                initializeTile(context, tile.index);
                buildPackets(context);
              }

              // moving to the end of the data
              length = tile.dataEnd - position;
              if (!isOnlyParseHeaders) {
                parseTilePackets(context, data, position, length);
              }
              
              break;
            case 0xFF64: // Comment (COM)
              length = readUint16(data, position);
              // skipping content
              break;
            case 0xFF53: // Coding style component (COC)
              throw new Error('JPX Error: Codestream code 0xFF53 (COC) is ' +
                              'not implemented');
            default:
              throw new Error('JPX Error: Unknown codestream code: ' +
                              code.toString(16));
          }
          position += length;
        }
      } catch (e) {
        if (doNotRecover || this.failOnCorruptedImage) {
          throw e;
        } else {
          warn('Trying to recover from ' + e.message);
        }
      }
      if (!isOnlyParseHeaders) {
        this.decode(context, options);
      }
      this.width = context.SIZ.Xsiz - context.SIZ.XOsiz;
      this.height = context.SIZ.Ysiz - context.SIZ.YOsiz;
      this.componentsCount = context.SIZ.Csiz;
      return context;
    },
    addPacketsData: function JpxImage_addPacketData(context, packetsData) {
      for (var j = 0; j < packetsData.packetDataOffsets.length; ++j) {
        var packetOffsets = packetsData.packetDataOffsets[j];
        var tile = context.tiles[packetOffsets.tileIndex];
        var component = tile.components[packetOffsets.c];
        var resolution = component.resolutions[packetOffsets.r];
        var p = packetOffsets.p;
        var l = packetOffsets.l;
        var packet = createPacket(resolution, p, l);
        for (var i = 0; i < packetOffsets.codeblockOffsets.length; ++i) {
          var codeblockOffsets = packetOffsets.codeblockOffsets[i];
          var isNoData = codeblockOffsets.start === codeblockOffsets.end;
          if (isNoData) {
            continue;
          }
          var codeblock = packet.codeblocks[i];
          if (codeblock['data'] === undefined) {
            codeblock.data = [];
          }
          if (codeblockOffsets.zeroBitPlanes !== undefined) {
            if (codeblock.zeroBitPlanes === undefined) {
              codeblock.zeroBitPlanes = codeblockOffsets.zeroBitPlanes;
            }
            if (codeblock.zeroBitPlanes !== codeblockOffsets.zeroBitPlanes) {
              throw 'JPX Error: Unmatched zero bit planes';
            }
          } else if (codeblock.zeroBitPlanes === undefined) {
            throw 'JPX Error: zeroBitPlanes is unknown';
          }
          codeblock.included = true;
          codeblock.data.push({
            data: packetsData.data,
            start: codeblockOffsets.start,
            end: codeblockOffsets.end,
            codingpasses: codeblockOffsets.codingpasses
          });
        }
      }
    },
    decode: function JpxImage_decode(context, options) {
      if (options !== undefined && options.regionToParse !== undefined) {
        var region = options.regionToParse;
        if (region.top === undefined ||
            region.left === undefined ||
            region.right === undefined ||
            region.bottom === undefined) {
          throw new Error('JPX Error: Either left, top, right or ' +
            'bottom are undefined in regionToParse');
        }
        context.regionToParse = region;
      }
      this.tiles = transformComponents(context);
      context.regionToParse = undefined;
    }
  };
  function calculateComponentDimensions(component, siz) {
    // Section B.2 Component mapping
    component.x0 = Math.ceil(siz.XOsiz / component.XRsiz);
    component.x1 = Math.ceil(siz.Xsiz / component.XRsiz);
    component.y0 = Math.ceil(siz.YOsiz / component.YRsiz);
    component.y1 = Math.ceil(siz.Ysiz / component.YRsiz);
    component.width = component.x1 - component.x0;
    component.height = component.y1 - component.y0;
  }
  function calculateTileGrids(context, components) {
    var siz = context.SIZ;
    // Section B.3 Division into tile and tile-components
    var tile, tiles = [];
    var numXtiles = Math.ceil((siz.Xsiz - siz.XTOsiz) / siz.XTsiz);
    var numYtiles = Math.ceil((siz.Ysiz - siz.YTOsiz) / siz.YTsiz);
    for (var q = 0; q < numYtiles; q++) {
      for (var p = 0; p < numXtiles; p++) {
        tile = {};
        tile.tx0 = Math.max(siz.XTOsiz + p * siz.XTsiz, siz.XOsiz);
        tile.ty0 = Math.max(siz.YTOsiz + q * siz.YTsiz, siz.YOsiz);
        tile.tx1 = Math.min(siz.XTOsiz + (p + 1) * siz.XTsiz, siz.Xsiz);
        tile.ty1 = Math.min(siz.YTOsiz + (q + 1) * siz.YTsiz, siz.Ysiz);
        tile.width = tile.tx1 - tile.tx0;
        tile.height = tile.ty1 - tile.ty0;
        tile.components = [];
        tiles.push(tile);
      }
    }
    context.tiles = tiles;

    var componentsCount = siz.Csiz;
    for (var i = 0, ii = componentsCount; i < ii; i++) {
      var component = components[i];
      for (var j = 0, jj = tiles.length; j < jj; j++) {
        var tileComponent = {};
        tile = tiles[j];
        tileComponent.tcx0 = Math.ceil(tile.tx0 / component.XRsiz);
        tileComponent.tcy0 = Math.ceil(tile.ty0 / component.YRsiz);
        tileComponent.tcx1 = Math.ceil(tile.tx1 / component.XRsiz);
        tileComponent.tcy1 = Math.ceil(tile.ty1 / component.YRsiz);
        tileComponent.width = tileComponent.tcx1 - tileComponent.tcx0;
        tileComponent.height = tileComponent.tcy1 - tileComponent.tcy0;
        tile.components[i] = tileComponent;
      }
    }
  }
  function getBlocksDimensions(context, component, r) {
    var codOrCoc = component.codingStyleParameters;
    var result = {};
    if (!codOrCoc.entropyCoderWithCustomPrecincts) {
      result.PPx = 15;
      result.PPy = 15;
    } else {
      result.PPx = codOrCoc.precinctsSizes[r].PPx;
      result.PPy = codOrCoc.precinctsSizes[r].PPy;
    }
    // calculate codeblock size as described in section B.7
    result.xcb_ = (r > 0 ? Math.min(codOrCoc.xcb, result.PPx - 1) :
                   Math.min(codOrCoc.xcb, result.PPx));
    result.ycb_ = (r > 0 ? Math.min(codOrCoc.ycb, result.PPy - 1) :
                   Math.min(codOrCoc.ycb, result.PPy));
    return result;
  }
  function buildPrecincts(context, resolution, dimensions) {
    // Section B.6 Division resolution to precincts
    var precinctWidth = 1 << dimensions.PPx;
    var precinctHeight = 1 << dimensions.PPy;
    // Jasper introduces codeblock groups for mapping each subband codeblocks
    // to precincts. Precinct partition divides a resolution according to width
    // and height parameters. The subband that belongs to the resolution level
    // has a different size than the level, unless it is the zero resolution.

    // From Jasper documentation: jpeg2000.pdf, section K: Tier-2 coding:
    // The precinct partitioning for a particular subband is derived from a
    // partitioning of its parent LL band (i.e., the LL band at the next higher
    // resolution level)... The LL band associated with each resolution level is
    // divided into precincts... Each of the resulting precinct regions is then
    // mapped into its child subbands (if any) at the next lower resolution
    // level. This is accomplished by using the coordinate transformation
    // (u, v) = (ceil(x/2), ceil(y/2)) where (x, y) and (u, v) are the
    // coordinates of a point in the LL band and child subband, respectively.
    var isZeroRes = resolution.resLevel === 0;
    var precinctWidthInSubband = 1 << (dimensions.PPx + (isZeroRes ? 0 : -1));
    var precinctHeightInSubband = 1 << (dimensions.PPy + (isZeroRes ? 0 : -1));
    var numprecinctswide = (resolution.trx1 > resolution.trx0 ?
      Math.ceil(resolution.trx1 / precinctWidth) -
      Math.floor(resolution.trx0 / precinctWidth) : 0);
    var numprecinctshigh = (resolution.try1 > resolution.try0 ?
      Math.ceil(resolution.try1 / precinctHeight) -
      Math.floor(resolution.try0 / precinctHeight) : 0);
    var numprecincts = numprecinctswide * numprecinctshigh;

    resolution.precinctParameters = {
      precinctWidth: precinctWidth,
      precinctHeight: precinctHeight,
      numprecinctswide: numprecinctswide,
      numprecinctshigh: numprecinctshigh,
      numprecincts: numprecincts,
      precinctWidthInSubband: precinctWidthInSubband,
      precinctHeightInSubband: precinctHeightInSubband
    };
  }
  function buildCodeblocks(context, subband, dimensions) {
    // Section B.7 Division sub-band into code-blocks
    var xcb_ = dimensions.xcb_;
    var ycb_ = dimensions.ycb_;
    var codeblockWidth = 1 << xcb_;
    var codeblockHeight = 1 << ycb_;
    var cbx0 = subband.tbx0 >> xcb_;
    var cby0 = subband.tby0 >> ycb_;
    var cbx1 = (subband.tbx1 + codeblockWidth - 1) >> xcb_;
    var cby1 = (subband.tby1 + codeblockHeight - 1) >> ycb_;
    var precinctParameters = subband.resolution.precinctParameters;
    var codeblocks = [];
    var precincts = [];
    var i, j, codeblock, precinctNumber;
    for (j = cby0; j < cby1; j++) {
      for (i = cbx0; i < cbx1; i++) {
        codeblock = {
          cbx: i,
          cby: j,
          tbx0: codeblockWidth * i,
          tby0: codeblockHeight * j,
          tbx1: codeblockWidth * (i + 1),
          tby1: codeblockHeight * (j + 1)
        };

        codeblock.tbx0_ = Math.max(subband.tbx0, codeblock.tbx0);
        codeblock.tby0_ = Math.max(subband.tby0, codeblock.tby0);
        codeblock.tbx1_ = Math.min(subband.tbx1, codeblock.tbx1);
        codeblock.tby1_ = Math.min(subband.tby1, codeblock.tby1);

        // Calculate precinct number for this codeblock, codeblock position
        // should be relative to its subband, use actual dimension and position
        // See comment about codeblock group width and height
        var pi = Math.floor((codeblock.tbx0_ - subband.tbx0) /
          precinctParameters.precinctWidthInSubband);
        var pj = Math.floor((codeblock.tby0_ - subband.tby0) /
          precinctParameters.precinctHeightInSubband);
        precinctNumber = pi + (pj * precinctParameters.numprecinctswide);

        codeblock.precinctNumber = precinctNumber;
        codeblock.subbandType = subband.type;
        codeblock.Lblock = 3;

        if (codeblock.tbx1_ <= codeblock.tbx0_ ||
            codeblock.tby1_ <= codeblock.tby0_) {
          continue;
        }
        codeblocks.push(codeblock);
        // building precinct for the sub-band
        var precinct = precincts[precinctNumber];
        if (precinct !== undefined) {
          if (i < precinct.cbxMin) {
            precinct.cbxMin = i;
          } else if (i > precinct.cbxMax) {
            precinct.cbxMax = i;
          }
          if (j < precinct.cbyMin) {
            precinct.cbxMin = j;
          } else if (j > precinct.cbyMax) {
            precinct.cbyMax = j;
          }
        } else {
          precincts[precinctNumber] = precinct = {
            cbxMin: i,
            cbyMin: j,
            cbxMax: i,
            cbyMax: j
          };
        }
        codeblock.precinct = precinct;
      }
    }
    subband.codeblockParameters = {
      codeblockWidth: xcb_,
      codeblockHeight: ycb_,
      numcodeblockwide: cbx1 - cbx0 + 1,
      numcodeblockhigh: cby1 - cby0 + 1
    };
    subband.codeblocks = codeblocks;
    subband.precincts = precincts;
  }
  function createPacket(resolution, precinctNumber, layerNumber) {
    var precinctCodeblocks = [];
    // Section B.10.8 Order of info in packet
    var subbands = resolution.subbands;
    // sub-bands already ordered in 'LL', 'HL', 'LH', and 'HH' sequence
    for (var i = 0, ii = subbands.length; i < ii; i++) {
      var subband = subbands[i];
      var codeblocks = subband.codeblocks;
      for (var j = 0, jj = codeblocks.length; j < jj; j++) {
        var codeblock = codeblocks[j];
        if (codeblock.precinctNumber !== precinctNumber) {
          continue;
        }
        precinctCodeblocks.push(codeblock);
      }
    }
    return {
      layerNumber: layerNumber,
      codeblocks: precinctCodeblocks
    };
  }
  function LayerResolutionComponentPositionIterator(context) {
    var siz = context.SIZ;
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var layersCount = tile.codingStyleDefaultParameters.layersCount;
    var componentsCount = siz.Csiz;
    var maxDecompositionLevelsCount = 0;
    for (var q = 0; q < componentsCount; q++) {
      maxDecompositionLevelsCount = Math.max(maxDecompositionLevelsCount,
        tile.components[q].codingStyleParameters.decompositionLevelsCount);
    }

    var l = 0, r = 0, i = 0, k = 0;

    this.nextPacket = function JpxImage_nextPacket() {
      // Section B.12.1.1 Layer-resolution-component-position
      for (; l < layersCount; l++) {
        for (; r <= maxDecompositionLevelsCount; r++) {
          for (; i < componentsCount; i++) {
            var component = tile.components[i];
            if (r > component.codingStyleParameters.decompositionLevelsCount) {
              continue;
            }

            var resolution = component.resolutions[r];
            var numprecincts = resolution.precinctParameters.numprecincts;
            for (; k < numprecincts;) {
              var packet = createPacket(resolution, k, l);
              k++;
              return packet;
            }
            k = 0;
          }
          i = 0;
        }
        r = 0;
      }
      throw new Error('JPX Error: Out of packets');
    };
  }
  function ResolutionLayerComponentPositionIterator(context) {
    var siz = context.SIZ;
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var layersCount = tile.codingStyleDefaultParameters.layersCount;
    var componentsCount = siz.Csiz;
    var maxDecompositionLevelsCount = 0;
    for (var q = 0; q < componentsCount; q++) {
      maxDecompositionLevelsCount = Math.max(maxDecompositionLevelsCount,
        tile.components[q].codingStyleParameters.decompositionLevelsCount);
    }

    var r = 0, l = 0, i = 0, k = 0;

    this.nextPacket = function JpxImage_nextPacket() {
      // Section B.12.1.2 Resolution-layer-component-position
      for (; r <= maxDecompositionLevelsCount; r++) {
        for (; l < layersCount; l++) {
          for (; i < componentsCount; i++) {
            var component = tile.components[i];
            if (r > component.codingStyleParameters.decompositionLevelsCount) {
              continue;
            }

            var resolution = component.resolutions[r];
            var numprecincts = resolution.precinctParameters.numprecincts;
            for (; k < numprecincts;) {
              var packet = createPacket(resolution, k, l);
              k++;
              return packet;
            }
            k = 0;
          }
          i = 0;
        }
        l = 0;
      }
      throw new Error('JPX Error: Out of packets');
    };
  }
  function ResolutionPositionComponentLayerIterator(context) {
    var siz = context.SIZ;
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var layersCount = tile.codingStyleDefaultParameters.layersCount;
    var componentsCount = siz.Csiz;
    var l, r, c, p;
    var maxDecompositionLevelsCount = 0;
    for (c = 0; c < componentsCount; c++) {
      var component = tile.components[c];
      maxDecompositionLevelsCount = Math.max(maxDecompositionLevelsCount,
        component.codingStyleParameters.decompositionLevelsCount);
    }
    var maxNumPrecinctsInLevel = new Int32Array(
      maxDecompositionLevelsCount + 1);
    for (r = 0; r <= maxDecompositionLevelsCount; ++r) {
      var maxNumPrecincts = 0;
      for (c = 0; c < componentsCount; ++c) {
        var resolutions = tile.components[c].resolutions;
        if (r < resolutions.length) {
          maxNumPrecincts = Math.max(maxNumPrecincts,
            resolutions[r].precinctParameters.numprecincts);
        }
      }
      maxNumPrecinctsInLevel[r] = maxNumPrecincts;
    }
    l = 0;
    r = 0;
    c = 0;
    p = 0;
    
    this.nextPacket = function JpxImage_nextPacket() {
      // Section B.12.1.3 Resolution-position-component-layer
      for (; r <= maxDecompositionLevelsCount; r++) {
        for (; p < maxNumPrecinctsInLevel[r]; p++) {
          for (; c < componentsCount; c++) {
            var component = tile.components[c];
            if (r > component.codingStyleParameters.decompositionLevelsCount) {
              continue;
            }
            var resolution = component.resolutions[r];
            var numprecincts = resolution.precinctParameters.numprecincts;
            if (p >= numprecincts) {
              continue;
            }
            for (; l < layersCount;) {
              var packet = createPacket(resolution, p, l);
              l++;
              return packet;
            }
            l = 0;
          }
          c = 0;
        }
        p = 0;
      }
      throw new Error('JPX Error: Out of packets');
    };
  }
  function PositionComponentResolutionLayerIterator(context) {
    var siz = context.SIZ;
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var layersCount = tile.codingStyleDefaultParameters.layersCount;
    var componentsCount = siz.Csiz;
    var precinctsSizes = getPrecinctSizesInImageScale(tile);
    var precinctsIterationSizes = precinctsSizes;
    var l = 0, r = 0, c = 0, px = 0, py = 0;

    this.nextPacket = function JpxImage_nextPacket() {
      // Section B.12.1.4 Position-component-resolution-layer
      for (; py < precinctsIterationSizes.maxNumHigh; py++) {
        for (; px < precinctsIterationSizes.maxNumWide; px++) {
          for (; c < componentsCount; c++) {
            var component = tile.components[c];
            var decompositionLevelsCount =
              component.codingStyleParameters.decompositionLevelsCount;
            for (; r <= decompositionLevelsCount; r++) {
              var resolution = component.resolutions[r];
              var sizeInImageScale =
                precinctsSizes.components[c].resolutions[r];
              var k = getPrecinctIndexIfExist(
                px,
                py,
                sizeInImageScale,
                precinctsIterationSizes,
                resolution);
              if (k === null) {
                continue;
              }
              for (; l < layersCount;) {
                var packet = createPacket(resolution, k, l);
                l++;
                return packet;
              }
              l = 0;
            }
            r = 0;
          }
          c = 0;
        }
        px = 0;
      }
      throw new Error('JPX Error: Out of packets');
    };
  }
  function ComponentPositionResolutionLayerIterator(context) {
    var siz = context.SIZ;
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var layersCount = tile.codingStyleDefaultParameters.layersCount;
    var componentsCount = siz.Csiz;
    var precinctsSizes = getPrecinctSizesInImageScale(tile);
    var l = 0, r = 0, c = 0, px = 0, py = 0;
    
    this.nextPacket = function JpxImage_nextPacket() {
      // Section B.12.1.5 Component-position-resolution-layer
      for (; c < componentsCount; ++c) {
        var component = tile.components[c];
        var precinctsIterationSizes = precinctsSizes.components[c];
        var decompositionLevelsCount =
          component.codingStyleParameters.decompositionLevelsCount;
        for (; py < precinctsIterationSizes.maxNumHigh; py++) {
          for (; px < precinctsIterationSizes.maxNumWide; px++) {
            for (; r <= decompositionLevelsCount; r++) {
              var resolution = component.resolutions[r];
              var sizeInImageScale = precinctsIterationSizes.resolutions[r];
              var k = getPrecinctIndexIfExist(
                px,
                py,
                sizeInImageScale,
                precinctsIterationSizes,
                resolution);
              if (k === null) {
                continue;
              }
              for (; l < layersCount;) {
                var packet = createPacket(resolution, k, l);
                l++;
                return packet;
              }
              l = 0;
            }
            r = 0;
          }
          px = 0;
        }
        py = 0;
      }
      throw new Error('JPX Error: Out of packets');
    };
  }
  function getPrecinctIndexIfExist(
    pxIndex, pyIndex, sizeInImageScale, precinctIterationSizes, resolution) {
    var posX = pxIndex * precinctIterationSizes.minWidth;
    var posY = pyIndex * precinctIterationSizes.minHeight;
    if (posX % sizeInImageScale.width !== 0 ||
        posY % sizeInImageScale.height !== 0) {
      return null;
    }
    var startPrecinctRowIndex =
      (posY / sizeInImageScale.width) *
      resolution.precinctParameters.numprecinctswide;
    return (posX / sizeInImageScale.height) + startPrecinctRowIndex;
  }
  function getPrecinctSizesInImageScale(tile) {
    var componentsCount = tile.components.length;
    var minWidth = Number.MAX_VALUE;
    var minHeight = Number.MAX_VALUE;
    var maxNumWide = 0;
    var maxNumHigh = 0;
    var sizePerComponent = new Array(componentsCount);
    for (var c = 0; c < componentsCount; c++) {
      var component = tile.components[c];
      var decompositionLevelsCount =
        component.codingStyleParameters.decompositionLevelsCount;
      var sizePerResolution = new Array(decompositionLevelsCount + 1);
      var minWidthCurrentComponent = Number.MAX_VALUE;
      var minHeightCurrentComponent = Number.MAX_VALUE;
      var maxNumWideCurrentComponent = 0;
      var maxNumHighCurrentComponent = 0;
      var scale = 1;
      for (var r = decompositionLevelsCount; r >= 0; --r) {
        var resolution = component.resolutions[r];
        var widthCurrentResolution =
          scale * resolution.precinctParameters.precinctWidth;
        var heightCurrentResolution =
          scale * resolution.precinctParameters.precinctHeight;
        minWidthCurrentComponent = Math.min(
          minWidthCurrentComponent,
          widthCurrentResolution);
        minHeightCurrentComponent = Math.min(
          minHeightCurrentComponent,
          heightCurrentResolution);
        maxNumWideCurrentComponent = Math.max(maxNumWideCurrentComponent,
          resolution.precinctParameters.numprecinctswide);
        maxNumHighCurrentComponent = Math.max(maxNumHighCurrentComponent,
          resolution.precinctParameters.numprecinctshigh);
        sizePerResolution[r] = {
          width: widthCurrentResolution,
          height: heightCurrentResolution
        };
        scale <<= 1;
      }
      minWidth = Math.min(minWidth, minWidthCurrentComponent);
      minHeight = Math.min(minHeight, minHeightCurrentComponent);
      maxNumWide = Math.max(maxNumWide, maxNumWideCurrentComponent);
      maxNumHigh = Math.max(maxNumHigh, maxNumHighCurrentComponent);
      sizePerComponent[c] = {
        resolutions: sizePerResolution,
        minWidth: minWidthCurrentComponent,
        minHeight: minHeightCurrentComponent,
        maxNumWide: maxNumWideCurrentComponent,
        maxNumHigh: maxNumHighCurrentComponent
      };
    }
    return {
      components: sizePerComponent,
      minWidth: minWidth,
      minHeight: minHeight,
      maxNumWide: maxNumWide,
      maxNumHigh: maxNumHigh
    };
  }
  function buildPackets(context) {
    var siz = context.SIZ;
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var componentsCount = siz.Csiz;
    // Creating resolutions and sub-bands for each component
    for (var c = 0; c < componentsCount; c++) {
      var component = tile.components[c];
      var decompositionLevelsCount =
        component.codingStyleParameters.decompositionLevelsCount;
      // Section B.5 Resolution levels and sub-bands
      var resolutions = [];
      var subbands = [];
      for (var r = 0; r <= decompositionLevelsCount; r++) {
        var blocksDimensions = getBlocksDimensions(context, component, r);
        var resolution = {};
        var scale = 1 << (decompositionLevelsCount - r);
        resolution.trx0 = Math.ceil(component.tcx0 / scale);
        resolution.try0 = Math.ceil(component.tcy0 / scale);
        resolution.trx1 = Math.ceil(component.tcx1 / scale);
        resolution.try1 = Math.ceil(component.tcy1 / scale);
        resolution.resLevel = r;
        buildPrecincts(context, resolution, blocksDimensions);
        resolutions.push(resolution);

        var subband;
        if (r === 0) {
          // one sub-band (LL) with last decomposition
          subband = {};
          subband.type = 'LL';
          subband.tbx0 = Math.ceil(component.tcx0 / scale);
          subband.tby0 = Math.ceil(component.tcy0 / scale);
          subband.tbx1 = Math.ceil(component.tcx1 / scale);
          subband.tby1 = Math.ceil(component.tcy1 / scale);
          subband.resolution = resolution;
          buildCodeblocks(context, subband, blocksDimensions);
          subbands.push(subband);
          resolution.subbands = [subband];
        } else {
          var bscale = 1 << (decompositionLevelsCount - r + 1);
          var resolutionSubbands = [];
          // three sub-bands (HL, LH and HH) with rest of decompositions
          subband = {};
          subband.type = 'HL';
          subband.tbx0 = Math.ceil(component.tcx0 / bscale - 0.5);
          subband.tby0 = Math.ceil(component.tcy0 / bscale);
          subband.tbx1 = Math.ceil(component.tcx1 / bscale - 0.5);
          subband.tby1 = Math.ceil(component.tcy1 / bscale);
          subband.resolution = resolution;
          buildCodeblocks(context, subband, blocksDimensions);
          subbands.push(subband);
          resolutionSubbands.push(subband);

          subband = {};
          subband.type = 'LH';
          subband.tbx0 = Math.ceil(component.tcx0 / bscale);
          subband.tby0 = Math.ceil(component.tcy0 / bscale - 0.5);
          subband.tbx1 = Math.ceil(component.tcx1 / bscale);
          subband.tby1 = Math.ceil(component.tcy1 / bscale - 0.5);
          subband.resolution = resolution;
          buildCodeblocks(context, subband, blocksDimensions);
          subbands.push(subband);
          resolutionSubbands.push(subband);

          subband = {};
          subband.type = 'HH';
          subband.tbx0 = Math.ceil(component.tcx0 / bscale - 0.5);
          subband.tby0 = Math.ceil(component.tcy0 / bscale - 0.5);
          subband.tbx1 = Math.ceil(component.tcx1 / bscale - 0.5);
          subband.tby1 = Math.ceil(component.tcy1 / bscale - 0.5);
          subband.resolution = resolution;
          buildCodeblocks(context, subband, blocksDimensions);
          subbands.push(subband);
          resolutionSubbands.push(subband);

          resolution.subbands = resolutionSubbands;
        }
      }
      component.resolutions = resolutions;
      component.subbands = subbands;
    }
    // Generate the packets sequence
    var progressionOrder = tile.codingStyleDefaultParameters.progressionOrder;
    switch (progressionOrder) {
      case 0:
        tile.packetsIterator =
          new LayerResolutionComponentPositionIterator(context);
        break;
      case 1:
        tile.packetsIterator =
          new ResolutionLayerComponentPositionIterator(context);
        break;
      case 2:
        tile.packetsIterator =
          new ResolutionPositionComponentLayerIterator(context);
        break;
      case 3:
        tile.packetsIterator =
          new PositionComponentResolutionLayerIterator(context);
        break;
      case 4:
        tile.packetsIterator =
          new ComponentPositionResolutionLayerIterator(context);
        break;
      default:
        throw new Error('JPX Error: Unsupported progression order ' +
                        progressionOrder);
    }
  }
  function parseTilePackets(context, data, offset, dataLength) {
    var position = 0;
    var buffer, bufferSize = 0, skipNextBit = false;
    function readBits(count) {
      while (bufferSize < count) {
        var b = data[offset + position];
        position++;
        if (skipNextBit) {
          buffer = (buffer << 7) | b;
          bufferSize += 7;
          skipNextBit = false;
        } else {
          buffer = (buffer << 8) | b;
          bufferSize += 8;
        }
        if (b === 0xFF) {
          skipNextBit = true;
        }
      }
      bufferSize -= count;
      return (buffer >>> bufferSize) & ((1 << count) - 1);
    }
    function skipMarkerIfEqual(value) {
      if (data[offset + position - 1] === 0xFF &&
          data[offset + position] === value) {
        skipBytes(1);
        return true;
      } else if (data[offset + position] === 0xFF &&
                 data[offset + position + 1] === value) {
        skipBytes(2);
        return true;
      }
      return false;
    }
    function skipBytes(count) {
      position += count;
    }
    function alignToByte() {
      bufferSize = 0;
      if (skipNextBit) {
        position++;
        skipNextBit = false;
      }
    }
    function readCodingpasses() {
      if (readBits(1) === 0) {
        return 1;
      }
      if (readBits(1) === 0) {
        return 2;
      }
      var value = readBits(2);
      if (value < 3) {
        return value + 3;
      }
      value = readBits(5);
      if (value < 31) {
        return value + 6;
      }
      value = readBits(7);
      return value + 37;
    }
    var tileIndex = context.currentTile.index;
    var tile = context.tiles[tileIndex];
    var sopMarkerUsed = context.COD.sopMarkerUsed;
    var ephMarkerUsed = context.COD.ephMarkerUsed;
    var packetsIterator = tile.packetsIterator;
    while (position < dataLength) {
      alignToByte();
      if (sopMarkerUsed && skipMarkerIfEqual(0x91)) {
        // Skip also marker segment length and packet sequence ID
        skipBytes(4);
      }
      var packet = packetsIterator.nextPacket();
      if (!readBits(1)) {
        continue;
      }
      var layerNumber = packet.layerNumber;
      var queue = [], codeblock;
      for (var i = 0, ii = packet.codeblocks.length; i < ii; i++) {
        codeblock = packet.codeblocks[i];
        var precinct = codeblock.precinct;
        var codeblockColumn = codeblock.cbx - precinct.cbxMin;
        var codeblockRow = codeblock.cby - precinct.cbyMin;
        var codeblockIncluded = false;
        var firstTimeInclusion = false;
        var valueReady;
        if (codeblock['included'] !== undefined) {
          codeblockIncluded = !!readBits(1);
        } else {
          // reading inclusion tree
          precinct = codeblock.precinct;
          var inclusionTree, zeroBitPlanesTree;
          if (precinct['inclusionTree'] !== undefined) {
            inclusionTree = precinct.inclusionTree;
          } else {
            // building inclusion and zero bit-planes trees
            var width = precinct.cbxMax - precinct.cbxMin + 1;
            var height = precinct.cbyMax - precinct.cbyMin + 1;
            inclusionTree = new InclusionTree(width, height, layerNumber);
            zeroBitPlanesTree = new TagTree(width, height);
            precinct.inclusionTree = inclusionTree;
            precinct.zeroBitPlanesTree = zeroBitPlanesTree;
          }

          if (inclusionTree.reset(codeblockColumn, codeblockRow, layerNumber)) {
            while (true) {
              if (readBits(1)) {
                valueReady = !inclusionTree.nextLevel();
                if (valueReady) {
                  codeblock.included = true;
                  codeblockIncluded = firstTimeInclusion = true;
                  break;
                }
              } else {
                inclusionTree.incrementValue(layerNumber);
                break;
              }
            }
          }
        }
        if (!codeblockIncluded) {
          continue;
        }
        if (firstTimeInclusion) {
          zeroBitPlanesTree = precinct.zeroBitPlanesTree;
          zeroBitPlanesTree.reset(codeblockColumn, codeblockRow);
          while (true) {
            if (readBits(1)) {
              valueReady = !zeroBitPlanesTree.nextLevel();
              if (valueReady) {
                break;
              }
            } else {
              zeroBitPlanesTree.incrementValue();
            }
          }
          codeblock.zeroBitPlanes = zeroBitPlanesTree.value;
        }
        var codingpasses = readCodingpasses();
        while (readBits(1)) {
          codeblock.Lblock++;
        }
        var codingpassesLog2 = log2(codingpasses);
        // rounding down log2
        var bits = ((codingpasses < (1 << codingpassesLog2)) ?
          codingpassesLog2 - 1 : codingpassesLog2) + codeblock.Lblock;
        var codedDataLength = readBits(bits);
        queue.push({
          codeblock: codeblock,
          codingpasses: codingpasses,
          dataLength: codedDataLength
        });
      }
      alignToByte();
      if (ephMarkerUsed) {
        skipMarkerIfEqual(0x92);
      }
      while (queue.length > 0) {
        var packetItem = queue.shift();
        codeblock = packetItem.codeblock;
        if (codeblock['data'] === undefined) {
          codeblock.data = [];
        }
        codeblock.data.push({
          data: data,
          start: offset + position,
          end: offset + position + packetItem.dataLength,
          codingpasses: packetItem.codingpasses
        });
        position += packetItem.dataLength;
      }
    }
    return position;
  }
  function copyCoefficients(coefficients, targetArrayWidth, targetArrayHeight,
                            subband,delta, mb, reversible,
                            segmentationSymbolUsed, regionInLevel) {
    var x0 = subband.tbx0;
    var y0 = subband.tby0;
    var codeblocks = subband.codeblocks;
    var right = subband.type.charAt(0) === 'H' ? 1 : 0;
    var bottom = subband.type.charAt(1) === 'H' ? targetArrayWidth : 0;
    var resolution = subband.resolution;
    var interleave = (subband.type !== 'LL');
    var regionInSubband;
    if (!interleave) {
      regionInSubband = regionInLevel;
    } else {
      regionInSubband = {
        x0: (regionInLevel.x0 - resolution.trx0) / 2 + subband.tbx0,
        y0: (regionInLevel.y0 - resolution.try0) / 2 + subband.tby0,
        x1: (regionInLevel.x1 - resolution.trx0) / 2 + subband.tbx0,
        y1: (regionInLevel.y1 - resolution.try0) / 2 + subband.tby0
      };
    }
    var targetArrayStep = interleave ? 2 : 1;

    for (var i = 0, ii = codeblocks.length; i < ii; ++i) {
      var codeblock = codeblocks[i];
      var blockWidth = codeblock.tbx1_ - codeblock.tbx0_;
      var blockHeight = codeblock.tby1_ - codeblock.tby0_;
      if (blockWidth === 0 || blockHeight === 0) {
        continue;
      }
      if (codeblock['data'] === undefined) {
        continue;
      }
      
      var regionInCodeblock = {
        x0: Math.max(codeblock.tbx0_, regionInSubband.x0),
        y0: Math.max(codeblock.tby0_, regionInSubband.y0),
        x1: Math.min(codeblock.tbx1_, regionInSubband.x1),
        y1: Math.min(codeblock.tby1_, regionInSubband.y1)
      };
      if (regionInCodeblock.x0 >= regionInCodeblock.x1 ||
          regionInCodeblock.y0 >= regionInCodeblock.y1) {
        continue;
      }

      var bitModel, currentCodingpassType;
      bitModel = new BitModel(blockWidth, blockHeight, codeblock.subbandType,
                              codeblock.zeroBitPlanes, mb);
      currentCodingpassType = 2; // first bit plane starts from cleanup

      // collect data
      var data = codeblock.data, totalLength = 0, codingpasses = 0;
      var j, jj, dataItem;
      for (j = 0, jj = data.length; j < jj; j++) {
        dataItem = data[j];
        totalLength += dataItem.end - dataItem.start;
        codingpasses += dataItem.codingpasses;
      }
      var encodedData = new Uint8Array(totalLength);
      var position = 0;
      for (j = 0, jj = data.length; j < jj; j++) {
        dataItem = data[j];
        var chunk = dataItem.data.subarray(dataItem.start, dataItem.end);
        encodedData.set(chunk, position);
        position += chunk.length;
      }
      // decoding the item
      var decoder = new ArithmeticDecoder(encodedData, 0, totalLength);
      bitModel.setDecoder(decoder);

      for (j = 0; j < codingpasses; j++) {
        switch (currentCodingpassType) {
          case 0:
            bitModel.runSignificancePropogationPass();
            break;
          case 1:
            bitModel.runMagnitudeRefinementPass();
            break;
          case 2:
            bitModel.runCleanupPass();
            if (segmentationSymbolUsed) {
              bitModel.checkSegmentationSymbol();
            }
            break;
        }
        currentCodingpassType = (currentCodingpassType + 1) % 3;
      }

      var sign = bitModel.coefficentsSign;
      var magnitude = bitModel.coefficentsMagnitude;
      var bitsDecoded = bitModel.bitsDecoded;
      var magnitudeCorrection = reversible ? 0 : 0.5;
      var k, n, nb;
      var regionInCodeblockWidth = regionInCodeblock.x1 - regionInCodeblock.x0;
      // Do the interleaving of Section F.3.3 here, so we do not need
      // to copy later. LL level is not interleaved, just copied.
      for (var row = regionInCodeblock.y0; row < regionInCodeblock.y1; ++row) {
        var codeblockOffset =
          (regionInCodeblock.x0 - codeblock.tbx0_) +
          (row - codeblock.tby0_) * blockWidth;
        var targetOffset =
          (regionInCodeblock.x0 - regionInSubband.x0) * targetArrayStep +
          (row - regionInSubband.y0) * targetArrayWidth * targetArrayStep +
          right + bottom;
          
        for (k = regionInCodeblock.x0; k < regionInCodeblock.x1; k++) {
          n = magnitude[codeblockOffset];
          if (n !== 0) {
            n = (n + magnitudeCorrection) * delta;
            if (sign[codeblockOffset] !== 0) {
              n = -n;
            }
            nb = bitsDecoded[codeblockOffset];
            if (reversible && (nb >= mb)) {
              coefficients[targetOffset] = n;
            } else {
              coefficients[targetOffset] = n * (1 << (mb - nb));
            }
          }
          targetOffset += targetArrayStep;
          ++codeblockOffset;
        }
      }
    }
  }
  function transformTile(context, tile, c) {
    var component = tile.components[c];
    var codingStyleParameters = component.codingStyleParameters;
    var quantizationParameters = component.quantizationParameters;
    var decompositionLevelsCount =
      codingStyleParameters.decompositionLevelsCount;
    var spqcds = quantizationParameters.SPqcds;
    var scalarExpounded = quantizationParameters.scalarExpounded;
    var guardBits = quantizationParameters.guardBits;
    var segmentationSymbolUsed = codingStyleParameters.segmentationSymbolUsed;
    var precision = context.components[c].precision;
    var relativeRegionInTile;
    if (context.regionToParse !== undefined) {
      var x1 = Math.min(component.tcx1, context.regionToParse.right);
      var y1 = Math.min(component.tcy1, context.regionToParse.bottom);
      relativeRegionInTile = {
        x0: Math.max(0, context.regionToParse.left - component.tcx0),
        y0: Math.max(0, context.regionToParse.top - component.tcy0),
        x1: x1 - component.tcx0,
        y1: y1 - component.tcy0
      };
    }

    var reversible = codingStyleParameters.reversibleTransformation;
    var transform = (reversible ? new ReversibleTransform() :
                                  new IrreversibleTransform());

    var subbandCoefficients = [];
    var b = 0;
    for (var i = 0; i <= decompositionLevelsCount; i++) {
      var resolution = component.resolutions[i];

      var width = resolution.trx1 - resolution.trx0;
      var height = resolution.try1 - resolution.try0;
      
      var regionInLevel, arrayWidth, arrayHeight;
      if (relativeRegionInTile === undefined) {
        arrayWidth = width;
        arrayHeight = height;
        regionInLevel = {
          x0: resolution.trx0,
          y0: resolution.try0,
          x1: resolution.trx1,
          y1: resolution.try1
        };
      } else {
        var scale = 1 << (decompositionLevelsCount - i);
        var redundantCoeffs = 4;
        regionInLevel = {
          x0: Math.ceil(relativeRegionInTile.x0 / scale) - redundantCoeffs,
          y0: Math.ceil(relativeRegionInTile.y0 / scale) - redundantCoeffs,
          x1: Math.ceil(relativeRegionInTile.x1 / scale) + redundantCoeffs,
          y1: Math.ceil(relativeRegionInTile.y1 / scale) + redundantCoeffs
        };
        regionInLevel.x0 = 2 * Math.floor(regionInLevel.x0 / 2) +
          resolution.trx0;
        regionInLevel.y0 = 2 * Math.floor(regionInLevel.y0 / 2) +
          resolution.try0;
        regionInLevel.x1 = 2 * Math.floor(regionInLevel.x1 / 2) +
          resolution.trx0;
        regionInLevel.y1 = 2 * Math.floor(regionInLevel.y1 / 2) +
          resolution.try0;
        
        regionInLevel.x0 = Math.max(regionInLevel.x0, resolution.trx0);
        regionInLevel.y0 = Math.max(regionInLevel.y0, resolution.try0);
        regionInLevel.x1 = Math.min(regionInLevel.x1, resolution.trx1);
        regionInLevel.y1 = Math.min(regionInLevel.y1, resolution.try1);
        
        arrayWidth = regionInLevel.x1 - regionInLevel.x0;
        arrayHeight = regionInLevel.y1 - regionInLevel.y0;
      }
      
      // Allocate space for the whole sublevel.
      var coefficients = new Float32Array(arrayWidth * arrayHeight);

      for (var j = 0, jj = resolution.subbands.length; j < jj; j++) {
        var mu, epsilon;
        if (!scalarExpounded) {
          // formula E-5
          mu = spqcds[0].mu;
          epsilon = spqcds[0].epsilon + (i > 0 ? 1 - i : 0);
        } else {
          mu = spqcds[b].mu;
          epsilon = spqcds[b].epsilon;
          b++;
        }

        var subband = resolution.subbands[j];
        var gainLog2 = SubbandsGainLog2[subband.type];

        // calulate quantization coefficient (Section E.1.1.1)
        var delta = (reversible ? 1 :
          Math.pow(2, precision + gainLog2 - epsilon) * (1 + mu / 2048));
        var mb = (guardBits + epsilon - 1);

        // In the first resolution level, copyCoefficients will fill the
        // whole array with coefficients. In the succeding passes,
        // copyCoefficients will consecutively fill in the values that belong
        // to the interleaved positions of the HL, LH, and HH coefficients.
        // The LL coefficients will then be interleaved in Transform.iterate().
        copyCoefficients(coefficients, arrayWidth, arrayHeight, subband, delta,
                         mb, reversible, segmentationSymbolUsed,
                         regionInLevel);
      }
      
      var relativeRegionInLevel = {
        x0: regionInLevel.x0 - resolution.trx0,
        y0: regionInLevel.y0 - resolution.try0,
        x1: regionInLevel.x1 - resolution.trx0,
        y1: regionInLevel.y1 - resolution.try0
      };
      subbandCoefficients.push({
        items: coefficients,
        relativeRegionInLevel: relativeRegionInLevel
      });
    }

    var result = transform.calculate(subbandCoefficients,
                                     component.tcx0, component.tcy0);
    var transformedRegion = result.relativeRegionInLevel;
    var transformedWidth = transformedRegion.x1 - transformedRegion.x0;
    
    var needCropTile = false;
    if (context.regionToParse !== undefined) {
      needCropTile =
        relativeRegionInTile.x0 !== transformedRegion.x0 ||
        relativeRegionInTile.y0 !== transformedRegion.y0 ||
        relativeRegionInTile.x1 !== transformedRegion.x1 ||
        relativeRegionInTile.y1 !== transformedRegion.y1;
    }
    if (!needCropTile) {
      var transformedHeight = transformedRegion.y1 - transformedRegion.y0;
      return {
        left: component.tcx0,
        top: component.tcy0,
        width: transformedWidth,
        height: transformedHeight,
        items: result.items
      };
    }
    
    // Crop the 4 redundant pixels used for the DWT
    
    var width = relativeRegionInTile.x1 - relativeRegionInTile.x0;
    var height = relativeRegionInTile.y1 - relativeRegionInTile.y0;
    
    var itemsWithRedundantPixels = result.items;
    var items = new Float32Array(width * height);
    
    var redundantRowsTop =
      relativeRegionInTile.y0 - transformedRegion.y0;
    var redundantColumnsLeft =
      relativeRegionInTile.x0 - transformedRegion.x0;
      
    var targetOffset = 0;
    var sourceOffset =
      redundantColumnsLeft + transformedWidth * redundantRowsTop;
    for (var i = 0; i < height; ++i) {
      var sourceEnd = sourceOffset + width;
      
      items.set(
        itemsWithRedundantPixels.subarray(sourceOffset, sourceEnd),
        targetOffset);
      
      sourceOffset += transformedWidth;
      targetOffset += width;
    }
    
    return {
      left: component.tcx0 + relativeRegionInTile.x0,
      top: component.tcy0 + relativeRegionInTile.y0,
      width: width,
      height: height,
      items: items
    };
  }
  function transformComponents(context) {
    var siz = context.SIZ;
    var components = context.components;
    var componentsCount = siz.Csiz;
    var resultImages = [];
    for (var i = 0, ii = context.tiles.length; i < ii; i++) {
      var tile = context.tiles[i];
      
      if (context.regionToParse !== undefined) {
        if (context.regionToParse.left >= tile.tx1 ||
            context.regionToParse.top >= tile.ty1 ||
            context.regionToParse.right <= tile.tx0 ||
            context.regionToParse.bottom <= tile.ty0) {
          continue;
        }
      }
      
      var transformedTiles = [];
      var c;
      for (c = 0; c < componentsCount; c++) {
        transformedTiles[c] = transformTile(context, tile, c);
      }
      var tile0 = transformedTiles[0];
      var out = new Uint8Array(tile0.items.length * componentsCount);
      var result = {
        left: tile0.left,
        top: tile0.top,
        width: tile0.width,
        height: tile0.height,
        items: out
      };

      // Section G.2.2 Inverse multi component transform
      var shift, offset, max, min, maxK;
      var pos = 0, j, jj, y0, y1, y2, r, g, b, k, val;
      if (tile.codingStyleDefaultParameters.multipleComponentTransform) {
        var fourComponents = componentsCount === 4;
        var y0items = transformedTiles[0].items;
        var y1items = transformedTiles[1].items;
        var y2items = transformedTiles[2].items;
        var y3items = fourComponents ? transformedTiles[3].items : null;

        // HACK: The multiple component transform formulas below assume that
        // all components have the same precision. With this in mind, we
        // compute shift and offset only once.
        shift = components[0].precision - 8;
        offset = (128 << shift) + 0.5;
        max = 255 * (1 << shift);
        maxK = max * 0.5;
        min = -maxK;

        var component0 = tile.components[0];
        var alpha01 = componentsCount - 3;
        jj = y0items.length;
        if (!component0.codingStyleParameters.reversibleTransformation) {
          // inverse irreversible multiple component transform
          for (j = 0; j < jj; j++, pos += alpha01) {
            y0 = y0items[j] + offset;
            y1 = y1items[j];
            y2 = y2items[j];
            r = y0 + 1.402 * y2;
            g = y0 - 0.34413 * y1 - 0.71414 * y2;
            b = y0 + 1.772 * y1;
            out[pos++] = r <= 0 ? 0 : r >= max ? 255 : r >> shift;
            out[pos++] = g <= 0 ? 0 : g >= max ? 255 : g >> shift;
            out[pos++] = b <= 0 ? 0 : b >= max ? 255 : b >> shift;
          }
        } else {
          // inverse reversible multiple component transform
          for (j = 0; j < jj; j++, pos += alpha01) {
            y0 = y0items[j] + offset;
            y1 = y1items[j];
            y2 = y2items[j];
            g = y0 - ((y2 + y1) >> 2);
            r = g + y2;
            b = g + y1;
            out[pos++] = r <= 0 ? 0 : r >= max ? 255 : r >> shift;
            out[pos++] = g <= 0 ? 0 : g >= max ? 255 : g >> shift;
            out[pos++] = b <= 0 ? 0 : b >= max ? 255 : b >> shift;
          }
        }
        if (fourComponents) {
          for (j = 0, pos = 3; j < jj; j++, pos += 4) {
            k = y3items[j];
            out[pos] = k <= min ? 0 : k >= maxK ? 255 : (k + offset) >> shift;
          }
        }
      } else { // no multi-component transform
        for (c = 0; c < componentsCount; c++) {
          var items = transformedTiles[c].items;
          shift = components[c].precision - 8;
          offset = (128 << shift) + 0.5;
          max = (127.5 * (1 << shift));
          min = -max;
          for (pos = c, j = 0, jj = items.length; j < jj; j++) {
            val = items[j];
            out[pos] = val <= min ? 0 :
                       val >= max ? 255 : (val + offset) >> shift;
            pos += componentsCount;
          }
        }
      }
      resultImages.push(result);
    }
    return resultImages;
  }
  function initializeTile(context, tileIndex) {
    var siz = context.SIZ;
    var componentsCount = siz.Csiz;
    var tile = context.tiles[tileIndex];
    for (var c = 0; c < componentsCount; c++) {
      var component = tile.components[c];
      var qcdOrQcc = (context.currentTile.QCC[c] !== undefined ?
        context.currentTile.QCC[c] : context.currentTile.QCD);
      component.quantizationParameters = qcdOrQcc;
      var codOrCoc = (context.currentTile.COC[c] !== undefined  ?
        context.currentTile.COC[c] : context.currentTile.COD);
      component.codingStyleParameters = codOrCoc;
    }
    tile.codingStyleDefaultParameters = context.currentTile.COD;
  }

  // Section B.10.2 Tag trees
  var TagTree = (function TagTreeClosure() {
    function TagTree(width, height) {
      var levelsLength = log2(Math.max(width, height)) + 1;
      this.levels = [];
      for (var i = 0; i < levelsLength; i++) {
        var level = {
          width: width,
          height: height,
          items: []
        };
        this.levels.push(level);
        width = Math.ceil(width / 2);
        height = Math.ceil(height / 2);
      }
    }
    TagTree.prototype = {
      reset: function TagTree_reset(i, j) {
        var currentLevel = 0, value = 0, level;
        while (currentLevel < this.levels.length) {
          level = this.levels[currentLevel];
          var index = i + j * level.width;
          if (level.items[index] !== undefined) {
            value = level.items[index];
            break;
          }
          level.index = index;
          i >>= 1;
          j >>= 1;
          currentLevel++;
        }
        currentLevel--;
        level = this.levels[currentLevel];
        level.items[level.index] = value;
        this.currentLevel = currentLevel;
        delete this.value;
      },
      incrementValue: function TagTree_incrementValue() {
        var level = this.levels[this.currentLevel];
        level.items[level.index]++;
      },
      nextLevel: function TagTree_nextLevel() {
        var currentLevel = this.currentLevel;
        var level = this.levels[currentLevel];
        var value = level.items[level.index];
        currentLevel--;
        if (currentLevel < 0) {
          this.value = value;
          return false;
        }

        this.currentLevel = currentLevel;
        level = this.levels[currentLevel];
        level.items[level.index] = value;
        return true;
      }
    };
    return TagTree;
  })();

  var InclusionTree = (function InclusionTreeClosure() {
    function InclusionTree(width, height,  defaultValue) {
      var levelsLength = log2(Math.max(width, height)) + 1;
      this.levels = [];
      for (var i = 0; i < levelsLength; i++) {
        var items = new Uint8Array(width * height);
        for (var j = 0, jj = items.length; j < jj; j++) {
          items[j] = defaultValue;
        }

        var level = {
          width: width,
          height: height,
          items: items
        };
        this.levels.push(level);

        width = Math.ceil(width / 2);
        height = Math.ceil(height / 2);
      }
    }
    InclusionTree.prototype = {
      reset: function InclusionTree_reset(i, j, stopValue) {
        var currentLevel = 0;
        while (currentLevel < this.levels.length) {
          var level = this.levels[currentLevel];
          var index = i + j * level.width;
          level.index = index;
          var value = level.items[index];

          if (value === 0xFF) {
            break;
          }

          if (value > stopValue) {
            this.currentLevel = currentLevel;
            // already know about this one, propagating the value to top levels
            this.propagateValues();
            return false;
          }

          i >>= 1;
          j >>= 1;
          currentLevel++;
        }
        this.currentLevel = currentLevel - 1;
        return true;
      },
      incrementValue: function InclusionTree_incrementValue(stopValue) {
        var level = this.levels[this.currentLevel];
        level.items[level.index] = stopValue + 1;
        this.propagateValues();
      },
      propagateValues: function InclusionTree_propagateValues() {
        var levelIndex = this.currentLevel;
        var level = this.levels[levelIndex];
        var currentValue = level.items[level.index];
        while (--levelIndex >= 0) {
          level = this.levels[levelIndex];
          level.items[level.index] = currentValue;
        }
      },
      nextLevel: function InclusionTree_nextLevel() {
        var currentLevel = this.currentLevel;
        var level = this.levels[currentLevel];
        var value = level.items[level.index];
        level.items[level.index] = 0xFF;
        currentLevel--;
        if (currentLevel < 0) {
          return false;
        }

        this.currentLevel = currentLevel;
        level = this.levels[currentLevel];
        level.items[level.index] = value;
        return true;
      }
    };
    return InclusionTree;
  })();

  // Section D. Coefficient bit modeling
  var BitModel = (function BitModelClosure() {
    var UNIFORM_CONTEXT = 17;
    var RUNLENGTH_CONTEXT = 18;
    // Table D-1
    // The index is binary presentation: 0dddvvhh, ddd - sum of Di (0..4),
    // vv - sum of Vi (0..2), and hh - sum of Hi (0..2)
    var LLAndLHContextsLabel = new Uint8Array([
      0, 5, 8, 0, 3, 7, 8, 0, 4, 7, 8, 0, 0, 0, 0, 0, 1, 6, 8, 0, 3, 7, 8, 0, 4,
      7, 8, 0, 0, 0, 0, 0, 2, 6, 8, 0, 3, 7, 8, 0, 4, 7, 8, 0, 0, 0, 0, 0, 2, 6,
      8, 0, 3, 7, 8, 0, 4, 7, 8, 0, 0, 0, 0, 0, 2, 6, 8, 0, 3, 7, 8, 0, 4, 7, 8
    ]);
    var HLContextLabel = new Uint8Array([
      0, 3, 4, 0, 5, 7, 7, 0, 8, 8, 8, 0, 0, 0, 0, 0, 1, 3, 4, 0, 6, 7, 7, 0, 8,
      8, 8, 0, 0, 0, 0, 0, 2, 3, 4, 0, 6, 7, 7, 0, 8, 8, 8, 0, 0, 0, 0, 0, 2, 3,
      4, 0, 6, 7, 7, 0, 8, 8, 8, 0, 0, 0, 0, 0, 2, 3, 4, 0, 6, 7, 7, 0, 8, 8, 8
    ]);
    var HHContextLabel = new Uint8Array([
      0, 1, 2, 0, 1, 2, 2, 0, 2, 2, 2, 0, 0, 0, 0, 0, 3, 4, 5, 0, 4, 5, 5, 0, 5,
      5, 5, 0, 0, 0, 0, 0, 6, 7, 7, 0, 7, 7, 7, 0, 7, 7, 7, 0, 0, 0, 0, 0, 8, 8,
      8, 0, 8, 8, 8, 0, 8, 8, 8, 0, 0, 0, 0, 0, 8, 8, 8, 0, 8, 8, 8, 0, 8, 8, 8
    ]);

    function BitModel(width, height, subband, zeroBitPlanes, mb) {
      this.width = width;
      this.height = height;

      this.contextLabelTable = (subband === 'HH' ? HHContextLabel :
        (subband === 'HL' ? HLContextLabel : LLAndLHContextsLabel));

      var coefficientCount = width * height;

      // coefficients outside the encoding region treated as insignificant
      // add border state cells for significanceState
      this.neighborsSignificance = new Uint8Array(coefficientCount);
      this.coefficentsSign = new Uint8Array(coefficientCount);
      this.coefficentsMagnitude = mb > 14 ? new Uint32Array(coefficientCount) :
                                  mb > 6 ? new Uint16Array(coefficientCount) :
                                  new Uint8Array(coefficientCount);
      this.processingFlags = new Uint8Array(coefficientCount);

      var bitsDecoded = new Uint8Array(coefficientCount);
      if (zeroBitPlanes !== 0) {
        for (var i = 0; i < coefficientCount; i++) {
          bitsDecoded[i] = zeroBitPlanes;
        }
      }
      this.bitsDecoded = bitsDecoded;

      this.reset();
    }

    BitModel.prototype = {
      setDecoder: function BitModel_setDecoder(decoder) {
        this.decoder = decoder;
      },
      reset: function BitModel_reset() {
        // We have 17 contexts that are accessed via context labels,
        // plus the uniform and runlength context.
        this.contexts = new Int8Array(19);

        // Contexts are packed into 1 byte:
        // highest 7 bits carry the index, lowest bit carries mps
        this.contexts[0] = (4 << 1) | 0;
        this.contexts[UNIFORM_CONTEXT] = (46 << 1) | 0;
        this.contexts[RUNLENGTH_CONTEXT] = (3 << 1) | 0;
      },
      setNeighborsSignificance:
        function BitModel_setNeighborsSignificance(row, column, index) {
        var neighborsSignificance = this.neighborsSignificance;
        var width = this.width, height = this.height;
        var left = (column > 0);
        var right = (column + 1 < width);
        var i;

        if (row > 0) {
          i = index - width;
          if (left) {
            neighborsSignificance[i - 1] += 0x10;
          }
          if (right) {
            neighborsSignificance[i + 1] += 0x10;
          }
          neighborsSignificance[i] += 0x04;
        }

        if (row + 1 < height) {
          i = index + width;
          if (left) {
            neighborsSignificance[i - 1] += 0x10;
          }
          if (right) {
            neighborsSignificance[i + 1] += 0x10;
          }
          neighborsSignificance[i] += 0x04;
        }

        if (left) {
          neighborsSignificance[index - 1] += 0x01;
        }
        if (right) {
          neighborsSignificance[index + 1] += 0x01;
        }
        neighborsSignificance[index] |= 0x80;
      },
      runSignificancePropogationPass:
        function BitModel_runSignificancePropogationPass() {
        var decoder = this.decoder;
        var width = this.width, height = this.height;
        var coefficentsMagnitude = this.coefficentsMagnitude;
        var coefficentsSign = this.coefficentsSign;
        var neighborsSignificance = this.neighborsSignificance;
        var processingFlags = this.processingFlags;
        var contexts = this.contexts;
        var labels = this.contextLabelTable;
        var bitsDecoded = this.bitsDecoded;
        var processedInverseMask = ~1;
        var processedMask = 1;
        var firstMagnitudeBitMask = 2;

        for (var i0 = 0; i0 < height; i0 += 4) {
          for (var j = 0; j < width; j++) {
            var index = i0 * width + j;
            for (var i1 = 0; i1 < 4; i1++, index += width) {
              var i = i0 + i1;
              if (i >= height) {
                break;
              }
              // clear processed flag first
              processingFlags[index] &= processedInverseMask;

              if (coefficentsMagnitude[index] ||
                  !neighborsSignificance[index]) {
                continue;
              }

              var contextLabel = labels[neighborsSignificance[index]];
              var decision = decoder.readBit(contexts, contextLabel);
              if (decision) {
                var sign = this.decodeSignBit(i, j, index);
                coefficentsSign[index] = sign;
                coefficentsMagnitude[index] = 1;
                this.setNeighborsSignificance(i, j, index);
                processingFlags[index] |= firstMagnitudeBitMask;
              }
              bitsDecoded[index]++;
              processingFlags[index] |= processedMask;
            }
          }
        }
      },
      decodeSignBit: function BitModel_decodeSignBit(row, column, index) {
        var width = this.width, height = this.height;
        var coefficentsMagnitude = this.coefficentsMagnitude;
        var coefficentsSign = this.coefficentsSign;
        var contribution, sign0, sign1, significance1;
        var contextLabel, decoded;

        // calculate horizontal contribution
        significance1 = (column > 0 && coefficentsMagnitude[index - 1] !== 0);
        if (column + 1 < width && coefficentsMagnitude[index + 1] !== 0) {
          sign1 = coefficentsSign[index + 1];
          if (significance1) {
            sign0 = coefficentsSign[index - 1];
            contribution = 1 - sign1 - sign0;
          } else {
            contribution = 1 - sign1 - sign1;
          }
        } else if (significance1) {
          sign0 = coefficentsSign[index - 1];
          contribution = 1 - sign0 - sign0;
        } else {
          contribution = 0;
        }
        var horizontalContribution = 3 * contribution;

        // calculate vertical contribution and combine with the horizontal
        significance1 = (row > 0 && coefficentsMagnitude[index - width] !== 0);
        if (row + 1 < height && coefficentsMagnitude[index + width] !== 0) {
          sign1 = coefficentsSign[index + width];
          if (significance1) {
            sign0 = coefficentsSign[index - width];
            contribution = 1 - sign1 - sign0 + horizontalContribution;
          } else {
            contribution = 1 - sign1 - sign1 + horizontalContribution;
          }
        } else if (significance1) {
          sign0 = coefficentsSign[index - width];
          contribution = 1 - sign0 - sign0 + horizontalContribution;
        } else {
          contribution = horizontalContribution;
        }

        if (contribution >= 0) {
          contextLabel = 9 + contribution;
          decoded = this.decoder.readBit(this.contexts, contextLabel);
        } else {
          contextLabel = 9 - contribution;
          decoded = this.decoder.readBit(this.contexts, contextLabel) ^ 1;
        }
        return decoded;
      },
      runMagnitudeRefinementPass:
        function BitModel_runMagnitudeRefinementPass() {
        var decoder = this.decoder;
        var width = this.width, height = this.height;
        var coefficentsMagnitude = this.coefficentsMagnitude;
        var neighborsSignificance = this.neighborsSignificance;
        var contexts = this.contexts;
        var bitsDecoded = this.bitsDecoded;
        var processingFlags = this.processingFlags;
        var processedMask = 1;
        var firstMagnitudeBitMask = 2;
        var length = width * height;
        var width4 = width * 4;

        for (var index0 = 0, indexNext; index0 < length; index0 = indexNext) {
          indexNext = Math.min(length, index0 + width4);
          for (var j = 0; j < width; j++) {
            for (var index = index0 + j; index < indexNext; index += width) {

              // significant but not those that have just become
              if (!coefficentsMagnitude[index] ||
                (processingFlags[index] & processedMask) !== 0) {
                continue;
              }

              var contextLabel = 16;
              if ((processingFlags[index] & firstMagnitudeBitMask) !== 0) {
                processingFlags[index] ^= firstMagnitudeBitMask;
                // first refinement
               var significance = neighborsSignificance[index] & 127;
               contextLabel = significance === 0 ? 15 : 14;
              }

              var bit = decoder.readBit(contexts, contextLabel);
              coefficentsMagnitude[index] =
                (coefficentsMagnitude[index] << 1) | bit;
              bitsDecoded[index]++;
              processingFlags[index] |= processedMask;
            }
          }
        }
      },
      runCleanupPass: function BitModel_runCleanupPass() {
        var decoder = this.decoder;
        var width = this.width, height = this.height;
        var neighborsSignificance = this.neighborsSignificance;
        var coefficentsMagnitude = this.coefficentsMagnitude;
        var coefficentsSign = this.coefficentsSign;
        var contexts = this.contexts;
        var labels = this.contextLabelTable;
        var bitsDecoded = this.bitsDecoded;
        var processingFlags = this.processingFlags;
        var processedMask = 1;
        var firstMagnitudeBitMask = 2;
        var oneRowDown = width;
        var twoRowsDown = width * 2;
        var threeRowsDown = width * 3;
        var iNext;
        for (var i0 = 0; i0 < height; i0 = iNext) {
          iNext = Math.min(i0 + 4, height);
          var indexBase = i0 * width;
          var checkAllEmpty = i0 + 3 < height;
          for (var j = 0; j < width; j++) {
            var index0 = indexBase + j;
            // using the property: labels[neighborsSignificance[index]] === 0
            // when neighborsSignificance[index] === 0
            var allEmpty = (checkAllEmpty &&
              processingFlags[index0] === 0 &&
              processingFlags[index0 + oneRowDown] === 0 &&
              processingFlags[index0 + twoRowsDown] === 0 &&
              processingFlags[index0 + threeRowsDown] === 0 &&
              neighborsSignificance[index0] === 0 &&
              neighborsSignificance[index0 + oneRowDown] === 0 &&
              neighborsSignificance[index0 + twoRowsDown] === 0 &&
              neighborsSignificance[index0 + threeRowsDown] === 0);
            var i1 = 0, index = index0;
            var i = i0, sign;
            if (allEmpty) {
              var hasSignificantCoefficent =
                decoder.readBit(contexts, RUNLENGTH_CONTEXT);
              if (!hasSignificantCoefficent) {
                bitsDecoded[index0]++;
                bitsDecoded[index0 + oneRowDown]++;
                bitsDecoded[index0 + twoRowsDown]++;
                bitsDecoded[index0 + threeRowsDown]++;
                continue; // next column
              }
              i1 = (decoder.readBit(contexts, UNIFORM_CONTEXT) << 1) |
                    decoder.readBit(contexts, UNIFORM_CONTEXT);
              if (i1 !== 0) {
                i = i0 + i1;
                index += i1 * width;
              }

              sign = this.decodeSignBit(i, j, index);
              coefficentsSign[index] = sign;
              coefficentsMagnitude[index] = 1;
              this.setNeighborsSignificance(i, j, index);
              processingFlags[index] |= firstMagnitudeBitMask;

              index = index0;
              for (var i2 = i0; i2 <= i; i2++, index += width) {
                bitsDecoded[index]++;
              }

              i1++;
            }
            for (i = i0 + i1; i < iNext; i++, index += width) {
              if (coefficentsMagnitude[index] ||
                (processingFlags[index] & processedMask) !== 0) {
                continue;
              }

              var contextLabel = labels[neighborsSignificance[index]];
              var decision = decoder.readBit(contexts, contextLabel);
              if (decision === 1) {
                sign = this.decodeSignBit(i, j, index);
                coefficentsSign[index] = sign;
                coefficentsMagnitude[index] = 1;
                this.setNeighborsSignificance(i, j, index);
                processingFlags[index] |= firstMagnitudeBitMask;
              }
              bitsDecoded[index]++;
            }
          }
        }
      },
      checkSegmentationSymbol: function BitModel_checkSegmentationSymbol() {
        var decoder = this.decoder;
        var contexts = this.contexts;
        var symbol = (decoder.readBit(contexts, UNIFORM_CONTEXT) << 3) |
                     (decoder.readBit(contexts, UNIFORM_CONTEXT) << 2) |
                     (decoder.readBit(contexts, UNIFORM_CONTEXT) << 1) |
                      decoder.readBit(contexts, UNIFORM_CONTEXT);
        if (symbol !== 0xA) {
          throw new Error('JPX Error: Invalid segmentation symbol');
        }
      }
    };

    return BitModel;
  })();

  // Section F, Discrete wavelet transformation
  var Transform = (function TransformClosure() {
    function Transform() {}

    Transform.prototype.calculate =
      function transformCalculate(subbands, u0, v0) {
      var ll = subbands[0];
      for (var i = 1, ii = subbands.length; i < ii; i++) {
        ll = this.iterate(ll, subbands[i], u0, v0);
      }
      return ll;
    };
    Transform.prototype.extend = function extend(buffer, offset, size) {
      // Section F.3.7 extending... using max extension of 4
      var i1 = offset - 1, j1 = offset + 1;
      var i2 = offset + size - 2, j2 = offset + size;
      buffer[i1--] = buffer[j1++];
      buffer[j2++] = buffer[i2--];
      buffer[i1--] = buffer[j1++];
      buffer[j2++] = buffer[i2--];
      buffer[i1--] = buffer[j1++];
      buffer[j2++] = buffer[i2--];
      buffer[i1] = buffer[j1];
      buffer[j2] = buffer[i2];
    };
    Transform.prototype.iterate = function Transform_iterate(ll, hl_lh_hh,
                                                             u0, v0) {
      var levelRegion = hl_lh_hh.relativeRegionInLevel;
      if (ll.relativeRegionInLevel.x0 * 2 > levelRegion.x0 ||
          ll.relativeRegionInLevel.y0 * 2 > levelRegion.y0 ||
          ll.relativeRegionInLevel.x1 * 2 < levelRegion.x1 ||
          ll.relativeRegionInLevel.y1 * 2 < levelRegion.y1) {
        throw new Error('JPX Error: region in LL is smaller than region in ' +
          'higher resolution level');
      }
      if (levelRegion.x0 % 2 !== 0 || levelRegion.y0 % 2 !== 0) {
        throw new Error('JPX Error: region in HL/LH/HH subbands begins in ' +
          'odd coefficients');
      }
      var llItems = ll.items;
      var width = levelRegion.x1 - levelRegion.x0;
      var height = levelRegion.y1 - levelRegion.y0;
      var llWidth = ll.relativeRegionInLevel.x1 - ll.relativeRegionInLevel.x0;
      var llOffsetX = levelRegion.x0 / 2 - ll.relativeRegionInLevel.x0;
      var llOffsetY = levelRegion.y0 / 2 - ll.relativeRegionInLevel.y0;
      var llOffset = llOffsetX + llOffsetY * llWidth;
      var items = hl_lh_hh.items;
      var i, j, k, l, u, v;

      // Interleave LL according to Section F.3.3
      for (i = 0; i < height; i += 2) {
        l = i * width;
        k = llOffset + (llWidth * i / 2);
        for (j = 0; j < width; j += 2, k++, l += 2) {
          items[l] = llItems[k];
        }
      }
      // The LL band is not needed anymore.
      llItems = ll.items = null;

      var bufferPadding = 4;
      var rowBuffer = new Float32Array(width + 2 * bufferPadding);

      // Section F.3.4 HOR_SR
      if (width === 1) {
        // if width = 1, when u0 even keep items as is, when odd divide by 2
        if ((u0 & 1) !== 0) {
          for (v = 0, k = 0; v < height; v++, k += width) {
            items[k] *= 0.5;
          }
        }
      } else {
        for (v = 0, k = 0; v < height; v++, k += width) {
          rowBuffer.set(items.subarray(k, k + width), bufferPadding);

          this.extend(rowBuffer, bufferPadding, width);
          this.filter(rowBuffer, bufferPadding, width);

          items.set(
            rowBuffer.subarray(bufferPadding, bufferPadding + width),
            k);
        }
      }

      // Accesses to the items array can take long, because it may not fit into
      // CPU cache and has to be fetched from main memory. Since subsequent
      // accesses to the items array are not local when reading columns, we
      // have a cache miss every time. To reduce cache misses, get up to
      // 'numBuffers' items at a time and store them into the individual
      // buffers. The colBuffers should be small enough to fit into CPU cache.
      var numBuffers = 16;
      var colBuffers = [];
      for (i = 0; i < numBuffers; i++) {
        colBuffers.push(new Float32Array(height + 2 * bufferPadding));
      }
      var b, currentBuffer = 0;
      ll = bufferPadding + height;

      // Section F.3.5 VER_SR
      if (height === 1) {
          // if height = 1, when v0 even keep items as is, when odd divide by 2
        if ((v0 & 1) !== 0) {
          for (u = 0; u < width; u++) {
            items[u] *= 0.5;
          }
        }
      } else {
        for (u = 0; u < width; u++) {
          // if we ran out of buffers, copy several image columns at once
          if (currentBuffer === 0) {
            numBuffers = Math.min(width - u, numBuffers);
            for (k = u, l = bufferPadding; l < ll; k += width, l++) {
              for (b = 0; b < numBuffers; b++) {
                colBuffers[b][l] = items[k + b];
              }
            }
            currentBuffer = numBuffers;
          }

          currentBuffer--;
          var buffer = colBuffers[currentBuffer];
          this.extend(buffer, bufferPadding, height);
          this.filter(buffer, bufferPadding, height);

          // If this is last buffer in this group of buffers, flush all buffers.
          if (currentBuffer === 0) {
            k = u - numBuffers + 1;
            for (l = bufferPadding; l < ll; k += width, l++) {
              for (b = 0; b < numBuffers; b++) {
                items[k + b] = colBuffers[b][l];
              }
            }
          }
        }
      }

      return {
        relativeRegionInLevel: levelRegion,
        items: items
      };
    };
    return Transform;
  })();

  // Section 3.8.2 Irreversible 9-7 filter
  var IrreversibleTransform = (function IrreversibleTransformClosure() {
    function IrreversibleTransform() {
      Transform.call(this);
    }

    IrreversibleTransform.prototype = Object.create(Transform.prototype);
    IrreversibleTransform.prototype.filter =
      function irreversibleTransformFilter(x, offset, length) {
      var len = length >> 1;
      offset = offset | 0;
      var j, n, current, next;

      var alpha = -1.586134342059924;
      var beta = -0.052980118572961;
      var gamma = 0.882911075530934;
      var delta = 0.443506852043971;
      var K = 1.230174104914001;
      var K_ = 1 / K;

      // step 1 is combined with step 3

      // step 2
      j = offset - 3;
      for (n = len + 4; n--; j += 2) {
        x[j] *= K_;
      }

      // step 1 & 3
      j = offset - 2;
      current = delta * x[j -1];
      for (n = len + 3; n--; j += 2) {
        next = delta * x[j + 1];
        x[j] = K * x[j] - current - next;
        if (n--) {
          j += 2;
          current = delta * x[j + 1];
          x[j] = K * x[j] - current - next;
        } else {
          break;
        }
      }

      // step 4
      j = offset - 1;
      current = gamma * x[j - 1];
      for (n = len + 2; n--; j += 2) {
        next = gamma * x[j + 1];
        x[j] -= current + next;
        if (n--) {
          j += 2;
          current = gamma * x[j + 1];
          x[j] -= current + next;
        } else {
          break;
        }
      }

      // step 5
      j = offset;
      current = beta * x[j - 1];
      for (n = len + 1; n--; j += 2) {
        next = beta * x[j + 1];
        x[j] -= current + next;
        if (n--) {
          j += 2;
          current = beta * x[j + 1];
          x[j] -= current + next;
        } else {
          break;
        }
      }

      // step 6
      if (len !== 0) {
        j = offset + 1;
        current = alpha * x[j - 1];
        for (n = len; n--; j += 2) {
          next = alpha * x[j + 1];
          x[j] -= current + next;
          if (n--) {
            j += 2;
            current = alpha * x[j + 1];
            x[j] -= current + next;
          } else {
            break;
          }
        }
      }
    };

    return IrreversibleTransform;
  })();

  // Section 3.8.1 Reversible 5-3 filter
  var ReversibleTransform = (function ReversibleTransformClosure() {
    function ReversibleTransform() {
      Transform.call(this);
    }

    ReversibleTransform.prototype = Object.create(Transform.prototype);
    ReversibleTransform.prototype.filter =
      function reversibleTransformFilter(x, offset, length) {
      var len = length >> 1;
      offset = offset | 0;
      var j, n;

      for (j = offset, n = len + 1; n--; j += 2) {
        x[j] -= (x[j - 1] + x[j + 1] + 2) >> 2;
      }

      for (j = offset + 1, n = len; n--; j += 2) {
        x[j] += (x[j - 1] + x[j + 1]) >> 1;
      }
    };

    return ReversibleTransform;
  })();

  return JpxImage;
})();
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals Cmd, ColorSpace, Dict, MozBlobBuilder, Name, PDFJS, Ref, URL,
           Promise */

'use strict';

var globalScope = (typeof window === 'undefined') ? this : window;

var isWorker = (typeof window === 'undefined');

var FONT_IDENTITY_MATRIX = [0.001, 0, 0, 0.001, 0, 0];

var TextRenderingMode = {
  FILL: 0,
  STROKE: 1,
  FILL_STROKE: 2,
  INVISIBLE: 3,
  FILL_ADD_TO_PATH: 4,
  STROKE_ADD_TO_PATH: 5,
  FILL_STROKE_ADD_TO_PATH: 6,
  ADD_TO_PATH: 7,
  FILL_STROKE_MASK: 3,
  ADD_TO_PATH_FLAG: 4
};

var ImageKind = {
  GRAYSCALE_1BPP: 1,
  RGB_24BPP: 2,
  RGBA_32BPP: 3
};

var AnnotationType = {
  WIDGET: 1,
  TEXT: 2,
  LINK: 3
};

var StreamType = {
  UNKNOWN: 0,
  FLATE: 1,
  LZW: 2,
  DCT: 3,
  JPX: 4,
  JBIG: 5,
  A85: 6,
  AHX: 7,
  CCF: 8,
  RL: 9
};

var FontType = {
  UNKNOWN: 0,
  TYPE1: 1,
  TYPE1C: 2,
  CIDFONTTYPE0: 3,
  CIDFONTTYPE0C: 4,
  TRUETYPE: 5,
  CIDFONTTYPE2: 6,
  TYPE3: 7,
  OPENTYPE: 8,
  TYPE0: 9,
  MMTYPE1: 10
};

// The global PDFJS object exposes the API
// In production, it will be declared outside a global wrapper
// In development, it will be declared here
if (!globalScope.PDFJS) {
  globalScope.PDFJS = {};
}

globalScope.PDFJS.pdfBug = false;

PDFJS.VERBOSITY_LEVELS = {
  errors: 0,
  warnings: 1,
  infos: 5
};

// All the possible operations for an operator list.
var OPS = PDFJS.OPS = {
  // Intentionally start from 1 so it is easy to spot bad operators that will be
  // 0's.
  dependency: 1,
  setLineWidth: 2,
  setLineCap: 3,
  setLineJoin: 4,
  setMiterLimit: 5,
  setDash: 6,
  setRenderingIntent: 7,
  setFlatness: 8,
  setGState: 9,
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  clip: 29,
  eoClip: 30,
  beginText: 31,
  endText: 32,
  setCharSpacing: 33,
  setWordSpacing: 34,
  setHScale: 35,
  setLeading: 36,
  setFont: 37,
  setTextRenderingMode: 38,
  setTextRise: 39,
  moveText: 40,
  setLeadingMoveText: 41,
  setTextMatrix: 42,
  nextLine: 43,
  showText: 44,
  showSpacedText: 45,
  nextLineShowText: 46,
  nextLineSetSpacingShowText: 47,
  setCharWidth: 48,
  setCharWidthAndBounds: 49,
  setStrokeColorSpace: 50,
  setFillColorSpace: 51,
  setStrokeColor: 52,
  setStrokeColorN: 53,
  setFillColor: 54,
  setFillColorN: 55,
  setStrokeGray: 56,
  setFillGray: 57,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  setStrokeCMYKColor: 60,
  setFillCMYKColor: 61,
  shadingFill: 62,
  beginInlineImage: 63,
  beginImageData: 64,
  endInlineImage: 65,
  paintXObject: 66,
  markPoint: 67,
  markPointProps: 68,
  beginMarkedContent: 69,
  beginMarkedContentProps: 70,
  endMarkedContent: 71,
  beginCompat: 72,
  endCompat: 73,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  beginGroup: 76,
  endGroup: 77,
  beginAnnotations: 78,
  endAnnotations: 79,
  beginAnnotation: 80,
  endAnnotation: 81,
  paintJpegXObject: 82,
  paintImageMaskXObject: 83,
  paintImageMaskXObjectGroup: 84,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintInlineImageXObjectGroup: 87,
  paintImageXObjectRepeat: 88,
  paintImageMaskXObjectRepeat: 89,
  paintSolidColorImageMask: 90,
  constructPath: 91
};

// A notice for devs. These are good for things that are helpful to devs, such
// as warning that Workers were disabled, which is important to devs but not
// end users.
function info(msg) {
  if (PDFJS.verbosity >= PDFJS.VERBOSITY_LEVELS.infos) {
    console.log('Info: ' + msg);
  }
}

// Non-fatal warnings.
function warn(msg) {
  if (PDFJS.verbosity >= PDFJS.VERBOSITY_LEVELS.warnings) {
    console.log('Warning: ' + msg);
  }
}

// Fatal errors that should trigger the fallback UI and halt execution by
// throwing an exception.
function error(msg) {
  // If multiple arguments were passed, pass them all to the log function.
  if (arguments.length > 1) {
    var logArguments = ['Error:'];
    logArguments.push.apply(logArguments, arguments);
    console.log.apply(console, logArguments);
    // Join the arguments into a single string for the lines below.
    msg = [].join.call(arguments, ' ');
  } else {
    console.log('Error: ' + msg);
  }
  console.log(backtrace());
  UnsupportedManager.notify(UNSUPPORTED_FEATURES.unknown);
  throw new Error(msg);
}

function backtrace() {
  try {
    throw new Error();
  } catch (e) {
    return e.stack ? e.stack.split('\n').slice(2).join('\n') : '';
  }
}

function assert(cond, msg) {
  if (!cond) {
    error(msg);
  }
}

var UNSUPPORTED_FEATURES = PDFJS.UNSUPPORTED_FEATURES = {
  unknown: 'unknown',
  forms: 'forms',
  javaScript: 'javaScript',
  smask: 'smask',
  shadingPattern: 'shadingPattern',
  font: 'font'
};

var UnsupportedManager = PDFJS.UnsupportedManager =
  (function UnsupportedManagerClosure() {
  var listeners = [];
  return {
    listen: function (cb) {
      listeners.push(cb);
    },
    notify: function (featureId) {
      warn('Unsupported feature "' + featureId + '"');
      for (var i = 0, ii = listeners.length; i < ii; i++) {
        listeners[i](featureId);
      }
    }
  };
})();

// Combines two URLs. The baseUrl shall be absolute URL. If the url is an
// absolute URL, it will be returned as is.
function combineUrl(baseUrl, url) {
  if (!url) {
    return baseUrl;
  }
  if (/^[a-z][a-z0-9+\-.]*:/i.test(url)) {
    return url;
  }
  var i;
  if (url.charAt(0) === '/') {
    // absolute path
    i = baseUrl.indexOf('://');
    if (url.charAt(1) === '/') {
      ++i;
    } else {
      i = baseUrl.indexOf('/', i + 3);
    }
    return baseUrl.substring(0, i) + url;
  } else {
    // relative path
    var pathLength = baseUrl.length;
    i = baseUrl.lastIndexOf('#');
    pathLength = i >= 0 ? i : pathLength;
    i = baseUrl.lastIndexOf('?', pathLength);
    pathLength = i >= 0 ? i : pathLength;
    var prefixLength = baseUrl.lastIndexOf('/', pathLength);
    return baseUrl.substring(0, prefixLength + 1) + url;
  }
}

// Validates if URL is safe and allowed, e.g. to avoid XSS.
function isValidUrl(url, allowRelative) {
  if (!url) {
    return false;
  }
  // RFC 3986 (http://tools.ietf.org/html/rfc3986#section-3.1)
  // scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
  var protocol = /^[a-z][a-z0-9+\-.]*(?=:)/i.exec(url);
  if (!protocol) {
    return allowRelative;
  }
  protocol = protocol[0].toLowerCase();
  switch (protocol) {
    case 'http':
    case 'https':
    case 'ftp':
    case 'mailto':
      return true;
    default:
      return false;
  }
}
PDFJS.isValidUrl = isValidUrl;

function shadow(obj, prop, value) {
  Object.defineProperty(obj, prop, { value: value,
                                     enumerable: true,
                                     configurable: true,
                                     writable: false });
  return value;
}

var PasswordResponses = PDFJS.PasswordResponses = {
  NEED_PASSWORD: 1,
  INCORRECT_PASSWORD: 2
};

var PasswordException = (function PasswordExceptionClosure() {
  function PasswordException(msg, code) {
    this.name = 'PasswordException';
    this.message = msg;
    this.code = code;
  }

  PasswordException.prototype = new Error();
  PasswordException.constructor = PasswordException;

  return PasswordException;
})();
PDFJS.PasswordException = PasswordException;

var UnknownErrorException = (function UnknownErrorExceptionClosure() {
  function UnknownErrorException(msg, details) {
    this.name = 'UnknownErrorException';
    this.message = msg;
    this.details = details;
  }

  UnknownErrorException.prototype = new Error();
  UnknownErrorException.constructor = UnknownErrorException;

  return UnknownErrorException;
})();
PDFJS.UnknownErrorException = UnknownErrorException;

var InvalidPDFException = (function InvalidPDFExceptionClosure() {
  function InvalidPDFException(msg) {
    this.name = 'InvalidPDFException';
    this.message = msg;
  }

  InvalidPDFException.prototype = new Error();
  InvalidPDFException.constructor = InvalidPDFException;

  return InvalidPDFException;
})();
PDFJS.InvalidPDFException = InvalidPDFException;

var MissingPDFException = (function MissingPDFExceptionClosure() {
  function MissingPDFException(msg) {
    this.name = 'MissingPDFException';
    this.message = msg;
  }

  MissingPDFException.prototype = new Error();
  MissingPDFException.constructor = MissingPDFException;

  return MissingPDFException;
})();
PDFJS.MissingPDFException = MissingPDFException;

var UnexpectedResponseException =
    (function UnexpectedResponseExceptionClosure() {
  function UnexpectedResponseException(msg, status) {
    this.name = 'UnexpectedResponseException';
    this.message = msg;
    this.status = status;
  }

  UnexpectedResponseException.prototype = new Error();
  UnexpectedResponseException.constructor = UnexpectedResponseException;

  return UnexpectedResponseException;
})();
PDFJS.UnexpectedResponseException = UnexpectedResponseException;

var NotImplementedException = (function NotImplementedExceptionClosure() {
  function NotImplementedException(msg) {
    this.message = msg;
  }

  NotImplementedException.prototype = new Error();
  NotImplementedException.prototype.name = 'NotImplementedException';
  NotImplementedException.constructor = NotImplementedException;

  return NotImplementedException;
})();

var MissingDataException = (function MissingDataExceptionClosure() {
  function MissingDataException(begin, end) {
    this.begin = begin;
    this.end = end;
    this.message = 'Missing data [' + begin + ', ' + end + ')';
  }

  MissingDataException.prototype = new Error();
  MissingDataException.prototype.name = 'MissingDataException';
  MissingDataException.constructor = MissingDataException;

  return MissingDataException;
})();

var XRefParseException = (function XRefParseExceptionClosure() {
  function XRefParseException(msg) {
    this.message = msg;
  }

  XRefParseException.prototype = new Error();
  XRefParseException.prototype.name = 'XRefParseException';
  XRefParseException.constructor = XRefParseException;

  return XRefParseException;
})();


function bytesToString(bytes) {
  var length = bytes.length;
  var MAX_ARGUMENT_COUNT = 8192;
  if (length < MAX_ARGUMENT_COUNT) {
    return String.fromCharCode.apply(null, bytes);
  }
  var strBuf = [];
  for (var i = 0; i < length; i += MAX_ARGUMENT_COUNT) {
    var chunkEnd = Math.min(i + MAX_ARGUMENT_COUNT, length);
    var chunk = bytes.subarray(i, chunkEnd);
    strBuf.push(String.fromCharCode.apply(null, chunk));
  }
  return strBuf.join('');
}

function stringToBytes(str) {
  var length = str.length;
  var bytes = new Uint8Array(length);
  for (var i = 0; i < length; ++i) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

function string32(value) {
  return String.fromCharCode((value >> 24) & 0xff, (value >> 16) & 0xff,
                             (value >> 8) & 0xff, value & 0xff);
}

function log2(x) {
  var n = 1, i = 0;
  while (x > n) {
    n <<= 1;
    i++;
  }
  return i;
}

function readInt8(data, start) {
  return (data[start] << 24) >> 24;
}

function readUint16(data, offset) {
  return (data[offset] << 8) | data[offset + 1];
}

function readUint32(data, offset) {
  return ((data[offset] << 24) | (data[offset + 1] << 16) |
         (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

// Lazy test the endianness of the platform
// NOTE: This will be 'true' for simulated TypedArrays
function isLittleEndian() {
  var buffer8 = new Uint8Array(2);
  buffer8[0] = 1;
  var buffer16 = new Uint16Array(buffer8.buffer);
  return (buffer16[0] === 1);
}

Object.defineProperty(PDFJS, 'isLittleEndian', {
  configurable: true,
  get: function PDFJS_isLittleEndian() {
    return shadow(PDFJS, 'isLittleEndian', isLittleEndian());
  }
});

//#if !(FIREFOX || MOZCENTRAL || B2G || CHROME)
//// Lazy test if the userAgant support CanvasTypedArrays
function hasCanvasTypedArrays() {
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  var ctx = canvas.getContext('2d');
  var imageData = ctx.createImageData(1, 1);
  return (typeof imageData.data.buffer !== 'undefined');
}

Object.defineProperty(PDFJS, 'hasCanvasTypedArrays', {
  configurable: true,
  get: function PDFJS_hasCanvasTypedArrays() {
    return shadow(PDFJS, 'hasCanvasTypedArrays', hasCanvasTypedArrays());
  }
});

var Uint32ArrayView = (function Uint32ArrayViewClosure() {

  function Uint32ArrayView(buffer, length) {
    this.buffer = buffer;
    this.byteLength = buffer.length;
    this.length = length === undefined ? (this.byteLength >> 2) : length;
    ensureUint32ArrayViewProps(this.length);
  }
  Uint32ArrayView.prototype = Object.create(null);

  var uint32ArrayViewSetters = 0;
  function createUint32ArrayProp(index) {
    return {
      get: function () {
        var buffer = this.buffer, offset = index << 2;
        return (buffer[offset] | (buffer[offset + 1] << 8) |
          (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24)) >>> 0;
      },
      set: function (value) {
        var buffer = this.buffer, offset = index << 2;
        buffer[offset] = value & 255;
        buffer[offset + 1] = (value >> 8) & 255;
        buffer[offset + 2] = (value >> 16) & 255;
        buffer[offset + 3] = (value >>> 24) & 255;
      }
    };
  }

  function ensureUint32ArrayViewProps(length) {
    while (uint32ArrayViewSetters < length) {
      Object.defineProperty(Uint32ArrayView.prototype,
        uint32ArrayViewSetters,
        createUint32ArrayProp(uint32ArrayViewSetters));
      uint32ArrayViewSetters++;
    }
  }

  return Uint32ArrayView;
})();
//#else
//PDFJS.hasCanvasTypedArrays = true;
//#endif

var IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

var Util = PDFJS.Util = (function UtilClosure() {
  function Util() {}

  var rgbBuf = ['rgb(', 0, ',', 0, ',', 0, ')'];

  // makeCssRgb() can be called thousands of times. Using |rgbBuf| avoids
  // creating many intermediate strings.
  Util.makeCssRgb = function Util_makeCssRgb(rgb) {
    rgbBuf[1] = rgb[0];
    rgbBuf[3] = rgb[1];
    rgbBuf[5] = rgb[2];
    return rgbBuf.join('');
  };

  // Concatenates two transformation matrices together and returns the result.
  Util.transform = function Util_transform(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  };

  // For 2d affine transforms
  Util.applyTransform = function Util_applyTransform(p, m) {
    var xt = p[0] * m[0] + p[1] * m[2] + m[4];
    var yt = p[0] * m[1] + p[1] * m[3] + m[5];
    return [xt, yt];
  };

  Util.applyInverseTransform = function Util_applyInverseTransform(p, m) {
    var d = m[0] * m[3] - m[1] * m[2];
    var xt = (p[0] * m[3] - p[1] * m[2] + m[2] * m[5] - m[4] * m[3]) / d;
    var yt = (-p[0] * m[1] + p[1] * m[0] + m[4] * m[1] - m[5] * m[0]) / d;
    return [xt, yt];
  };

  // Applies the transform to the rectangle and finds the minimum axially
  // aligned bounding box.
  Util.getAxialAlignedBoundingBox =
    function Util_getAxialAlignedBoundingBox(r, m) {

    var p1 = Util.applyTransform(r, m);
    var p2 = Util.applyTransform(r.slice(2, 4), m);
    var p3 = Util.applyTransform([r[0], r[3]], m);
    var p4 = Util.applyTransform([r[2], r[1]], m);
    return [
      Math.min(p1[0], p2[0], p3[0], p4[0]),
      Math.min(p1[1], p2[1], p3[1], p4[1]),
      Math.max(p1[0], p2[0], p3[0], p4[0]),
      Math.max(p1[1], p2[1], p3[1], p4[1])
    ];
  };

  Util.inverseTransform = function Util_inverseTransform(m) {
    var d = m[0] * m[3] - m[1] * m[2];
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d,
      (m[2] * m[5] - m[4] * m[3]) / d, (m[4] * m[1] - m[5] * m[0]) / d];
  };

  // Apply a generic 3d matrix M on a 3-vector v:
  //   | a b c |   | X |
  //   | d e f | x | Y |
  //   | g h i |   | Z |
  // M is assumed to be serialized as [a,b,c,d,e,f,g,h,i],
  // with v as [X,Y,Z]
  Util.apply3dTransform = function Util_apply3dTransform(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  };

  // This calculation uses Singular Value Decomposition.
  // The SVD can be represented with formula A = USV. We are interested in the
  // matrix S here because it represents the scale values.
  Util.singularValueDecompose2dScale =
    function Util_singularValueDecompose2dScale(m) {

    var transpose = [m[0], m[2], m[1], m[3]];

    // Multiply matrix m with its transpose.
    var a = m[0] * transpose[0] + m[1] * transpose[2];
    var b = m[0] * transpose[1] + m[1] * transpose[3];
    var c = m[2] * transpose[0] + m[3] * transpose[2];
    var d = m[2] * transpose[1] + m[3] * transpose[3];

    // Solve the second degree polynomial to get roots.
    var first = (a + d) / 2;
    var second = Math.sqrt((a + d) * (a + d) - 4 * (a * d - c * b)) / 2;
    var sx = first + second || 1;
    var sy = first - second || 1;

    // Scale values are the square roots of the eigenvalues.
    return [Math.sqrt(sx), Math.sqrt(sy)];
  };

  // Normalize rectangle rect=[x1, y1, x2, y2] so that (x1,y1) < (x2,y2)
  // For coordinate systems whose origin lies in the bottom-left, this
  // means normalization to (BL,TR) ordering. For systems with origin in the
  // top-left, this means (TL,BR) ordering.
  Util.normalizeRect = function Util_normalizeRect(rect) {
    var r = rect.slice(0); // clone rect
    if (rect[0] > rect[2]) {
      r[0] = rect[2];
      r[2] = rect[0];
    }
    if (rect[1] > rect[3]) {
      r[1] = rect[3];
      r[3] = rect[1];
    }
    return r;
  };

  // Returns a rectangle [x1, y1, x2, y2] corresponding to the
  // intersection of rect1 and rect2. If no intersection, returns 'false'
  // The rectangle coordinates of rect1, rect2 should be [x1, y1, x2, y2]
  Util.intersect = function Util_intersect(rect1, rect2) {
    function compare(a, b) {
      return a - b;
    }

    // Order points along the axes
    var orderedX = [rect1[0], rect1[2], rect2[0], rect2[2]].sort(compare),
        orderedY = [rect1[1], rect1[3], rect2[1], rect2[3]].sort(compare),
        result = [];

    rect1 = Util.normalizeRect(rect1);
    rect2 = Util.normalizeRect(rect2);

    // X: first and second points belong to different rectangles?
    if ((orderedX[0] === rect1[0] && orderedX[1] === rect2[0]) ||
        (orderedX[0] === rect2[0] && orderedX[1] === rect1[0])) {
      // Intersection must be between second and third points
      result[0] = orderedX[1];
      result[2] = orderedX[2];
    } else {
      return false;
    }

    // Y: first and second points belong to different rectangles?
    if ((orderedY[0] === rect1[1] && orderedY[1] === rect2[1]) ||
        (orderedY[0] === rect2[1] && orderedY[1] === rect1[1])) {
      // Intersection must be between second and third points
      result[1] = orderedY[1];
      result[3] = orderedY[2];
    } else {
      return false;
    }

    return result;
  };

  Util.sign = function Util_sign(num) {
    return num < 0 ? -1 : 1;
  };

  Util.appendToArray = function Util_appendToArray(arr1, arr2) {
    Array.prototype.push.apply(arr1, arr2);
  };

  Util.prependToArray = function Util_prependToArray(arr1, arr2) {
    Array.prototype.unshift.apply(arr1, arr2);
  };

  Util.extendObj = function extendObj(obj1, obj2) {
    for (var key in obj2) {
      obj1[key] = obj2[key];
    }
  };

  Util.getInheritableProperty = function Util_getInheritableProperty(dict,
                                                                     name) {
    while (dict && !dict.has(name)) {
      dict = dict.get('Parent');
    }
    if (!dict) {
      return null;
    }
    return dict.get(name);
  };

  Util.inherit = function Util_inherit(sub, base, prototype) {
    sub.prototype = Object.create(base.prototype);
    sub.prototype.constructor = sub;
    for (var prop in prototype) {
      sub.prototype[prop] = prototype[prop];
    }
  };

  Util.loadScript = function Util_loadScript(src, callback) {
    var script = document.createElement('script');
    var loaded = false;
    script.setAttribute('src', src);
    if (callback) {
      script.onload = function() {
        if (!loaded) {
          callback();
        }
        loaded = true;
      };
    }
    document.getElementsByTagName('head')[0].appendChild(script);
  };

  return Util;
})();

/**
 * PDF page viewport created based on scale, rotation and offset.
 * @class
 * @alias PDFJS.PageViewport
 */
var PageViewport = PDFJS.PageViewport = (function PageViewportClosure() {
  /**
   * @constructor
   * @private
   * @param viewBox {Array} xMin, yMin, xMax and yMax coordinates.
   * @param scale {number} scale of the viewport.
   * @param rotation {number} rotations of the viewport in degrees.
   * @param offsetX {number} offset X
   * @param offsetY {number} offset Y
   * @param dontFlip {boolean} if true, axis Y will not be flipped.
   */
  function PageViewport(viewBox, scale, rotation, offsetX, offsetY, dontFlip) {
    this.viewBox = viewBox;
    this.scale = scale;
    this.rotation = rotation;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    // creating transform to convert pdf coordinate system to the normal
    // canvas like coordinates taking in account scale and rotation
    var centerX = (viewBox[2] + viewBox[0]) / 2;
    var centerY = (viewBox[3] + viewBox[1]) / 2;
    var rotateA, rotateB, rotateC, rotateD;
    rotation = rotation % 360;
    rotation = rotation < 0 ? rotation + 360 : rotation;
    switch (rotation) {
      case 180:
        rotateA = -1; rotateB = 0; rotateC = 0; rotateD = 1;
        break;
      case 90:
        rotateA = 0; rotateB = 1; rotateC = 1; rotateD = 0;
        break;
      case 270:
        rotateA = 0; rotateB = -1; rotateC = -1; rotateD = 0;
        break;
      //case 0:
      default:
        rotateA = 1; rotateB = 0; rotateC = 0; rotateD = -1;
        break;
    }

    if (dontFlip) {
      rotateC = -rotateC; rotateD = -rotateD;
    }

    var offsetCanvasX, offsetCanvasY;
    var width, height;
    if (rotateA === 0) {
      offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale + offsetY;
      width = Math.abs(viewBox[3] - viewBox[1]) * scale;
      height = Math.abs(viewBox[2] - viewBox[0]) * scale;
    } else {
      offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale + offsetY;
      width = Math.abs(viewBox[2] - viewBox[0]) * scale;
      height = Math.abs(viewBox[3] - viewBox[1]) * scale;
    }
    // creating transform for the following operations:
    // translate(-centerX, -centerY), rotate and flip vertically,
    // scale, and translate(offsetCanvasX, offsetCanvasY)
    this.transform = [
      rotateA * scale,
      rotateB * scale,
      rotateC * scale,
      rotateD * scale,
      offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY,
      offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY
    ];

    this.width = width;
    this.height = height;
    this.fontScale = scale;
  }
  PageViewport.prototype = /** @lends PDFJS.PageViewport.prototype */ {
    /**
     * Clones viewport with additional properties.
     * @param args {Object} (optional) If specified, may contain the 'scale' or
     * 'rotation' properties to override the corresponding properties in
     * the cloned viewport.
     * @returns {PDFJS.PageViewport} Cloned viewport.
     */
    clone: function PageViewPort_clone(args) {
      args = args || {};
      var scale = 'scale' in args ? args.scale : this.scale;
      var rotation = 'rotation' in args ? args.rotation : this.rotation;
      return new PageViewport(this.viewBox.slice(), scale, rotation,
                              this.offsetX, this.offsetY, args.dontFlip);
    },
    /**
     * Converts PDF point to the viewport coordinates. For examples, useful for
     * converting PDF location into canvas pixel coordinates.
     * @param x {number} X coordinate.
     * @param y {number} Y coordinate.
     * @returns {Object} Object that contains 'x' and 'y' properties of the
     * point in the viewport coordinate space.
     * @see {@link convertToPdfPoint}
     * @see {@link convertToViewportRectangle}
     */
    convertToViewportPoint: function PageViewport_convertToViewportPoint(x, y) {
      return Util.applyTransform([x, y], this.transform);
    },
    /**
     * Converts PDF rectangle to the viewport coordinates.
     * @param rect {Array} xMin, yMin, xMax and yMax coordinates.
     * @returns {Array} Contains corresponding coordinates of the rectangle
     * in the viewport coordinate space.
     * @see {@link convertToViewportPoint}
     */
    convertToViewportRectangle:
      function PageViewport_convertToViewportRectangle(rect) {
      var tl = Util.applyTransform([rect[0], rect[1]], this.transform);
      var br = Util.applyTransform([rect[2], rect[3]], this.transform);
      return [tl[0], tl[1], br[0], br[1]];
    },
    /**
     * Converts viewport coordinates to the PDF location. For examples, useful
     * for converting canvas pixel location into PDF one.
     * @param x {number} X coordinate.
     * @param y {number} Y coordinate.
     * @returns {Object} Object that contains 'x' and 'y' properties of the
     * point in the PDF coordinate space.
     * @see {@link convertToViewportPoint}
     */
    convertToPdfPoint: function PageViewport_convertToPdfPoint(x, y) {
      return Util.applyInverseTransform([x, y], this.transform);
    }
  };
  return PageViewport;
})();

var PDFStringTranslateTable = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0x2D8, 0x2C7, 0x2C6, 0x2D9, 0x2DD, 0x2DB, 0x2DA, 0x2DC, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2022, 0x2020, 0x2021, 0x2026, 0x2014,
  0x2013, 0x192, 0x2044, 0x2039, 0x203A, 0x2212, 0x2030, 0x201E, 0x201C,
  0x201D, 0x2018, 0x2019, 0x201A, 0x2122, 0xFB01, 0xFB02, 0x141, 0x152, 0x160,
  0x178, 0x17D, 0x131, 0x142, 0x153, 0x161, 0x17E, 0, 0x20AC
];

function stringToPDFString(str) {
  var i, n = str.length, strBuf = [];
  if (str[0] === '\xFE' && str[1] === '\xFF') {
    // UTF16BE BOM
    for (i = 2; i < n; i += 2) {
      strBuf.push(String.fromCharCode(
        (str.charCodeAt(i) << 8) | str.charCodeAt(i + 1)));
    }
  } else {
    for (i = 0; i < n; ++i) {
      var code = PDFStringTranslateTable[str.charCodeAt(i)];
      strBuf.push(code ? String.fromCharCode(code) : str.charAt(i));
    }
  }
  return strBuf.join('');
}

function stringToUTF8String(str) {
  return decodeURIComponent(escape(str));
}

function isEmptyObj(obj) {
  for (var key in obj) {
    return false;
  }
  return true;
}

function isBool(v) {
  return typeof v === 'boolean';
}

function isInt(v) {
  return typeof v === 'number' && ((v | 0) === v);
}

function isNum(v) {
  return typeof v === 'number';
}

function isString(v) {
  return typeof v === 'string';
}

function isNull(v) {
  return v === null;
}

function isName(v) {
  return v instanceof Name;
}

function isCmd(v, cmd) {
  return v instanceof Cmd && (cmd === undefined || v.cmd === cmd);
}

function isDict(v, type) {
  if (!(v instanceof Dict)) {
    return false;
  }
  if (!type) {
    return true;
  }
  var dictType = v.get('Type');
  return isName(dictType) && dictType.name === type;
}

function isArray(v) {
  return v instanceof Array;
}

function isStream(v) {
  return typeof v === 'object' && v !== null && v.getBytes !== undefined;
}

function isArrayBuffer(v) {
  return typeof v === 'object' && v !== null && v.byteLength !== undefined;
}

function isRef(v) {
  return v instanceof Ref;
}

/**
 * Promise Capability object.
 *
 * @typedef {Object} PromiseCapability
 * @property {Promise} promise - A promise object.
 * @property {function} resolve - Fullfills the promise.
 * @property {function} reject - Rejects the promise.
 */

/**
 * Creates a promise capability object.
 * @alias PDFJS.createPromiseCapability
 *
 * @return {PromiseCapability} A capability object contains:
 * - a Promise, resolve and reject methods.
 */
function createPromiseCapability() {
  var capability = {};
  capability.promise = new Promise(function (resolve, reject) {
    capability.resolve = resolve;
    capability.reject = reject;
  });
  return capability;
}

PDFJS.createPromiseCapability = createPromiseCapability;

/**
 * Polyfill for Promises:
 * The following promise implementation tries to generally implement the
 * Promise/A+ spec. Some notable differences from other promise libaries are:
 * - There currently isn't a seperate deferred and promise object.
 * - Unhandled rejections eventually show an error if they aren't handled.
 *
 * Based off of the work in:
 * https://bugzilla.mozilla.org/show_bug.cgi?id=810490
 */
(function PromiseClosure() {
  if (globalScope.Promise) {
    // Promises existing in the DOM/Worker, checking presence of all/resolve
    if (typeof globalScope.Promise.all !== 'function') {
      globalScope.Promise.all = function (iterable) {
        var count = 0, results = [], resolve, reject;
        var promise = new globalScope.Promise(function (resolve_, reject_) {
          resolve = resolve_;
          reject = reject_;
        });
        iterable.forEach(function (p, i) {
          count++;
          p.then(function (result) {
            results[i] = result;
            count--;
            if (count === 0) {
              resolve(results);
            }
          }, reject);
        });
        if (count === 0) {
          resolve(results);
        }
        return promise;
      };
    }
    if (typeof globalScope.Promise.resolve !== 'function') {
      globalScope.Promise.resolve = function (value) {
        return new globalScope.Promise(function (resolve) { resolve(value); });
      };
    }
    if (typeof globalScope.Promise.reject !== 'function') {
      globalScope.Promise.reject = function (reason) {
        return new globalScope.Promise(function (resolve, reject) {
          reject(reason);
        });
      };
    }
    if (typeof globalScope.Promise.prototype.catch !== 'function') {
      globalScope.Promise.prototype.catch = function (onReject) {
        return globalScope.Promise.prototype.then(undefined, onReject);
      };
    }
    return;
  }
//#if !MOZCENTRAL
  var STATUS_PENDING = 0;
  var STATUS_RESOLVED = 1;
  var STATUS_REJECTED = 2;

  // In an attempt to avoid silent exceptions, unhandled rejections are
  // tracked and if they aren't handled in a certain amount of time an
  // error is logged.
  var REJECTION_TIMEOUT = 500;

  var HandlerManager = {
    handlers: [],
    running: false,
    unhandledRejections: [],
    pendingRejectionCheck: false,

    scheduleHandlers: function scheduleHandlers(promise) {
      if (promise._status === STATUS_PENDING) {
        return;
      }

      this.handlers = this.handlers.concat(promise._handlers);
      promise._handlers = [];

      if (this.running) {
        return;
      }
      this.running = true;

      setTimeout(this.runHandlers.bind(this), 0);
    },

    runHandlers: function runHandlers() {
      var RUN_TIMEOUT = 1; // ms
      var timeoutAt = Date.now() + RUN_TIMEOUT;
      while (this.handlers.length > 0) {
        var handler = this.handlers.shift();

        var nextStatus = handler.thisPromise._status;
        var nextValue = handler.thisPromise._value;

        try {
          if (nextStatus === STATUS_RESOLVED) {
            if (typeof handler.onResolve === 'function') {
              nextValue = handler.onResolve(nextValue);
            }
          } else if (typeof handler.onReject === 'function') {
              nextValue = handler.onReject(nextValue);
              nextStatus = STATUS_RESOLVED;

              if (handler.thisPromise._unhandledRejection) {
                this.removeUnhandeledRejection(handler.thisPromise);
              }
          }
        } catch (ex) {
          nextStatus = STATUS_REJECTED;
          nextValue = ex;
        }

        handler.nextPromise._updateStatus(nextStatus, nextValue);
        if (Date.now() >= timeoutAt) {
          break;
        }
      }

      if (this.handlers.length > 0) {
        setTimeout(this.runHandlers.bind(this), 0);
        return;
      }

      this.running = false;
    },

    addUnhandledRejection: function addUnhandledRejection(promise) {
      this.unhandledRejections.push({
        promise: promise,
        time: Date.now()
      });
      this.scheduleRejectionCheck();
    },

    removeUnhandeledRejection: function removeUnhandeledRejection(promise) {
      promise._unhandledRejection = false;
      for (var i = 0; i < this.unhandledRejections.length; i++) {
        if (this.unhandledRejections[i].promise === promise) {
          this.unhandledRejections.splice(i);
          i--;
        }
      }
    },

    scheduleRejectionCheck: function scheduleRejectionCheck() {
      if (this.pendingRejectionCheck) {
        return;
      }
      this.pendingRejectionCheck = true;
      setTimeout(function rejectionCheck() {
        this.pendingRejectionCheck = false;
        var now = Date.now();
        for (var i = 0; i < this.unhandledRejections.length; i++) {
          if (now - this.unhandledRejections[i].time > REJECTION_TIMEOUT) {
            var unhandled = this.unhandledRejections[i].promise._value;
            var msg = 'Unhandled rejection: ' + unhandled;
            if (unhandled.stack) {
              msg += '\n' + unhandled.stack;
            }
            warn(msg);
            this.unhandledRejections.splice(i);
            i--;
          }
        }
        if (this.unhandledRejections.length) {
          this.scheduleRejectionCheck();
        }
      }.bind(this), REJECTION_TIMEOUT);
    }
  };

  function Promise(resolver) {
    this._status = STATUS_PENDING;
    this._handlers = [];
    try {
      resolver.call(this, this._resolve.bind(this), this._reject.bind(this));
    } catch (e) {
      this._reject(e);
    }
  }
  /**
   * Builds a promise that is resolved when all the passed in promises are
   * resolved.
   * @param {array} array of data and/or promises to wait for.
   * @return {Promise} New dependant promise.
   */
  Promise.all = function Promise_all(promises) {
    var resolveAll, rejectAll;
    var deferred = new Promise(function (resolve, reject) {
      resolveAll = resolve;
      rejectAll = reject;
    });
    var unresolved = promises.length;
    var results = [];
    if (unresolved === 0) {
      resolveAll(results);
      return deferred;
    }
    function reject(reason) {
      if (deferred._status === STATUS_REJECTED) {
        return;
      }
      results = [];
      rejectAll(reason);
    }
    for (var i = 0, ii = promises.length; i < ii; ++i) {
      var promise = promises[i];
      var resolve = (function(i) {
        return function(value) {
          if (deferred._status === STATUS_REJECTED) {
            return;
          }
          results[i] = value;
          unresolved--;
          if (unresolved === 0) {
            resolveAll(results);
          }
        };
      })(i);
      if (Promise.isPromise(promise)) {
        promise.then(resolve, reject);
      } else {
        resolve(promise);
      }
    }
    return deferred;
  };

  /**
   * Checks if the value is likely a promise (has a 'then' function).
   * @return {boolean} true if value is thenable
   */
  Promise.isPromise = function Promise_isPromise(value) {
    return value && typeof value.then === 'function';
  };

  /**
   * Creates resolved promise
   * @param value resolve value
   * @returns {Promise}
   */
  Promise.resolve = function Promise_resolve(value) {
    return new Promise(function (resolve) { resolve(value); });
  };

  /**
   * Creates rejected promise
   * @param reason rejection value
   * @returns {Promise}
   */
  Promise.reject = function Promise_reject(reason) {
    return new Promise(function (resolve, reject) { reject(reason); });
  };

  Promise.prototype = {
    _status: null,
    _value: null,
    _handlers: null,
    _unhandledRejection: null,

    _updateStatus: function Promise__updateStatus(status, value) {
      if (this._status === STATUS_RESOLVED ||
          this._status === STATUS_REJECTED) {
        return;
      }

      if (status === STATUS_RESOLVED &&
          Promise.isPromise(value)) {
        value.then(this._updateStatus.bind(this, STATUS_RESOLVED),
                   this._updateStatus.bind(this, STATUS_REJECTED));
        return;
      }

      this._status = status;
      this._value = value;

      if (status === STATUS_REJECTED && this._handlers.length === 0) {
        this._unhandledRejection = true;
        HandlerManager.addUnhandledRejection(this);
      }

      HandlerManager.scheduleHandlers(this);
    },

    _resolve: function Promise_resolve(value) {
      this._updateStatus(STATUS_RESOLVED, value);
    },

    _reject: function Promise_reject(reason) {
      this._updateStatus(STATUS_REJECTED, reason);
    },

    then: function Promise_then(onResolve, onReject) {
      var nextPromise = new Promise(function (resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
      });
      this._handlers.push({
        thisPromise: this,
        onResolve: onResolve,
        onReject: onReject,
        nextPromise: nextPromise
      });
      HandlerManager.scheduleHandlers(this);
      return nextPromise;
    },

    catch: function Promise_catch(onReject) {
      return this.then(undefined, onReject);
    }
  };

  globalScope.Promise = Promise;
//#else
//throw new Error('DOM Promise is not present');
//#endif
})();

var StatTimer = (function StatTimerClosure() {
  function rpad(str, pad, length) {
    while (str.length < length) {
      str += pad;
    }
    return str;
  }
  function StatTimer() {
    this.started = {};
    this.times = [];
    this.enabled = true;
  }
  StatTimer.prototype = {
    time: function StatTimer_time(name) {
      if (!this.enabled) {
        return;
      }
      if (name in this.started) {
        warn('Timer is already running for ' + name);
      }
      this.started[name] = Date.now();
    },
    timeEnd: function StatTimer_timeEnd(name) {
      if (!this.enabled) {
        return;
      }
      if (!(name in this.started)) {
        warn('Timer has not been started for ' + name);
      }
      this.times.push({
        'name': name,
        'start': this.started[name],
        'end': Date.now()
      });
      // Remove timer from started so it can be called again.
      delete this.started[name];
    },
    toString: function StatTimer_toString() {
      var i, ii;
      var times = this.times;
      var out = '';
      // Find the longest name for padding purposes.
      var longest = 0;
      for (i = 0, ii = times.length; i < ii; ++i) {
        var name = times[i]['name'];
        if (name.length > longest) {
          longest = name.length;
        }
      }
      for (i = 0, ii = times.length; i < ii; ++i) {
        var span = times[i];
        var duration = span.end - span.start;
        out += rpad(span['name'], ' ', longest) + ' ' + duration + 'ms\n';
      }
      return out;
    }
  };
  return StatTimer;
})();

PDFJS.createBlob = function createBlob(data, contentType) {
  if (typeof Blob !== 'undefined') {
    return new Blob([data], { type: contentType });
  }
  // Blob builder is deprecated in FF14 and removed in FF18.
  var bb = new MozBlobBuilder();
  bb.append(data);
  return bb.getBlob(contentType);
};

PDFJS.createObjectURL = (function createObjectURLClosure() {
  // Blob/createObjectURL is not available, falling back to data schema.
  var digits =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  return function createObjectURL(data, contentType) {
    if (!PDFJS.disableCreateObjectURL &&
        typeof URL !== 'undefined' && URL.createObjectURL) {
      var blob = PDFJS.createBlob(data, contentType);
      return URL.createObjectURL(blob);
    }

    var buffer = 'data:' + contentType + ';base64,';
    for (var i = 0, ii = data.length; i < ii; i += 3) {
      var b1 = data[i] & 0xFF;
      var b2 = data[i + 1] & 0xFF;
      var b3 = data[i + 2] & 0xFF;
      var d1 = b1 >> 2, d2 = ((b1 & 3) << 4) | (b2 >> 4);
      var d3 = i + 1 < ii ? ((b2 & 0xF) << 2) | (b3 >> 6) : 64;
      var d4 = i + 2 < ii ? (b3 & 0x3F) : 64;
      buffer += digits[d1] + digits[d2] + digits[d3] + digits[d4];
    }
    return buffer;
  };
})();

function MessageHandler(name, comObj) {
  this.name = name;
  this.comObj = comObj;
  this.callbackIndex = 1;
  this.postMessageTransfers = true;
  var callbacksCapabilities = this.callbacksCapabilities = {};
  var ah = this.actionHandler = {};

  ah['console_log'] = [function ahConsoleLog(data) {
    console.log.apply(console, data);
  }];
  ah['console_error'] = [function ahConsoleError(data) {
    console.error.apply(console, data);
  }];
  ah['_unsupported_feature'] = [function ah_unsupportedFeature(data) {
    UnsupportedManager.notify(data);
  }];

  comObj.onmessage = function messageHandlerComObjOnMessage(event) {
    var data = event.data;
    if (data.isReply) {
      var callbackId = data.callbackId;
      if (data.callbackId in callbacksCapabilities) {
        var callback = callbacksCapabilities[callbackId];
        delete callbacksCapabilities[callbackId];
        if ('error' in data) {
          callback.reject(data.error);
        } else {
          callback.resolve(data.data);
        }
      } else {
        error('Cannot resolve callback ' + callbackId);
      }
    } else if (data.action in ah) {
      var action = ah[data.action];
      if (data.callbackId) {
        Promise.resolve().then(function () {
          return action[0].call(action[1], data.data);
        }).then(function (result) {
          comObj.postMessage({
            isReply: true,
            callbackId: data.callbackId,
            data: result
          });
        }, function (reason) {
          comObj.postMessage({
            isReply: true,
            callbackId: data.callbackId,
            error: reason
          });
        });
      } else {
        action[0].call(action[1], data.data);
      }
    } else {
      error('Unknown action from worker: ' + data.action);
    }
  };
}

MessageHandler.prototype = {
  on: function messageHandlerOn(actionName, handler, scope) {
    var ah = this.actionHandler;
    if (ah[actionName]) {
      error('There is already an actionName called "' + actionName + '"');
    }
    ah[actionName] = [handler, scope];
  },
  /**
   * Sends a message to the comObj to invoke the action with the supplied data.
   * @param {String} actionName Action to call.
   * @param {JSON} data JSON data to send.
   * @param {Array} [transfers] Optional list of transfers/ArrayBuffers
   */
  send: function messageHandlerSend(actionName, data, transfers) {
    var message = {
      action: actionName,
      data: data
    };
    this.postMessage(message, transfers);
  },
  /**
   * Sends a message to the comObj to invoke the action with the supplied data.
   * Expects that other side will callback with the response.
   * @param {String} actionName Action to call.
   * @param {JSON} data JSON data to send.
   * @param {Array} [transfers] Optional list of transfers/ArrayBuffers.
   * @returns {Promise} Promise to be resolved with response data.
   */
  sendWithPromise:
    function messageHandlerSendWithPromise(actionName, data, transfers) {
    var callbackId = this.callbackIndex++;
    var message = {
      action: actionName,
      data: data,
      callbackId: callbackId
    };
    var capability = createPromiseCapability();
    this.callbacksCapabilities[callbackId] = capability;
    try {
      this.postMessage(message, transfers);
    } catch (e) {
      capability.reject(e);
    }
    return capability.promise;
  },
  /**
   * Sends raw message to the comObj.
   * @private
   * @param message {Object} Raw message.
   * @param transfers List of transfers/ArrayBuffers, or undefined.
   */
  postMessage: function (message, transfers) {
    if (transfers && this.postMessageTransfers) {
      this.comObj.postMessage(message, transfers);
    } else {
      this.comObj.postMessage(message);
    }
  }
};

function loadJpegStream(id, imageUrl, objs) {
  var img = new Image();
  img.onload = (function loadJpegStream_onloadClosure() {
    objs.resolve(id, img);
  });
  img.onerror = (function loadJpegStream_onerrorClosure() {
    objs.resolve(id, null);
    warn('Error during JPEG image loading');
  });
  img.src = imageUrl;
}

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.webjpip = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = JpipFetch;

var jGlobals = require('j2k-jpip-globals.js');

function JpipFetch(fetchContext, requester, progressiveness) {
    var codestreamPartParams = null;
    var dedicatedChannelHandle = null;
    var serverRequest = null;
    var isFailure = false;
    var isTerminated = false;
    var isProgressive = false;
    //var isDone = false;
    var requestedProgressiveStage = 0;
    //var reachedQualityLayer = 0;
    var nextProgressiveStage = 0;
    
    this.setDedicatedChannelHandle = function setDedicatedChannelHandle(
        dedicatedChannelHandle_) {
        
        dedicatedChannelHandle = dedicatedChannelHandle_;
    };
    
    this.move = function move(codestreamPartParams_) {
        if (dedicatedChannelHandle === null && codestreamPartParams !== null) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Cannot move non movable fetch');
        }
        codestreamPartParams = codestreamPartParams_;
        requestData();
    };
    
    this.resume = function resume() {
        requestData();
    };
    
    this.stop = function stop() {
        if (serverRequest === null) {
            if (isTerminated/* || isDone*/) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Cannot stop already terminated fetch');
            }
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Cannot stop already stopped fetch');
        }
        
        if (!dedicatedChannelHandle) {
            requester.stopRequestAsync(serverRequest);
            serverRequest = null;
        }
        
        // NOTE: Send a stop request within JpipRequest and resolve the Promise
        // only after server response (This is only performance issue, no
        // functional problem: a new fetch will trigger a JPIP request with
        // wait=no, and the old request will be actually stopped).
        return fetchContext.stopped();
    };
    
    this.terminate = function terminate() {
        if (dedicatedChannelHandle) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Unexpected terminate event on movable fetch');
        }
        if (isTerminated) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Double terminate event');
        }
        
        serverRequest = null;
        isTerminated = true;
    };
    
    this.isProgressiveChanged = function isProgressiveChanged(isProgressive_) {
        isProgressive = isProgressive_;
        if (dedicatedChannelHandle && serverRequest !== null) {
            serverRequest = null;
            requestData();
        }
    };
    
    function requestData() {
        if (nextProgressiveStage >= progressiveness.length) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Unexpected requestData() after fetch done');
        }
        if (serverRequest !== null && dedicatedChannelHandle === null) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Cannot resume already-active-fetch');
        }
        
        if (isTerminated) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Cannot resume already-terminated-fetch');
        }

        setTimeout(function() {
            if (nextProgressiveStage >= progressiveness.length ||
                serverRequest !== null ||
                isTerminated) {
                    
                return;
            }
            
            //if (isDone) {
            //    return;
            //}
            
            requestedProgressiveStage =
                isProgressive ? nextProgressiveStage : progressiveness.length - 1;
                
            serverRequest = requester.requestData(
                codestreamPartParams,
                requesterCallbackOnAllDataRecieved,
                requesterCallbackOnFailure,
                progressiveness[requestedProgressiveStage].minNumQualityLayers,
                dedicatedChannelHandle);
        });
    }

    function requesterCallbackOnAllDataRecieved(request, isResponseDone) {
        serverRequest = null;
        if (!isResponseDone) {
            return;
        }
        
        //if (isTerminated && requestedQualityLayer > reachedQualityLayer) {
        //    throw new jGlobals.jpipExceptions.IllegalDataException(
        //        'JPIP server not returned all data', 'D.3');
        //}
        nextProgressiveStage = requestedProgressiveStage;
        if (nextProgressiveStage >= progressiveness.length) {
            fetchContext.done();
        }
    };

    function requesterCallbackOnFailure() {
        //updateStatus(STATUS_ENDED, 'endAsync()');
        
        //if (failureCallback !== undefined) {
        //    failureCallback(self, userContextVars);
        //} else {
        //    isFailure = true;
        //}
        isFailure = true;

        //if (isMoved) {
        //    throw new jGlobals.jpipExceptions.InternalErrorException(
        //        'Failure callback to an old fetch which has been already moved');
        //}
    };
}

//function JpipFetchHandle(requester, imageDataContext, dedicatedChannelHandle) {
//    this._requester = requester;
//    this._imageDataContext = imageDataContext;
//    this._serverRequest = null;
//    this._dedicatedChannelHandle = dedicatedChannelHandle;
//    this._isFailure = false;
//    this._isMoved = false;
//    this._requestedQualityLayer = 0;
//    this._reachedQualityLayer = 0;
//    this._requesterCallbackOnFailureBound = this._requesterCallbackOnFailure.bind(this);
//    
//    if (imageDataContext.isDisposed()) {
//        throw new jGlobals.jpipExceptions.IllegalOperationException(
//            'Cannot initialize JpipFetchHandle with disposed ImageDataContext');
//    }
//    imageDataContext.on('data', this._onData.bind(this));
//}
//
//JpipFetchHandle.prototype.resume = function resume() {
//    if (this._serverRequest !== null) {
//        throw new jGlobals.jpipExceptions.IllegalOperationException(
//            'Cannot resume already-active-fetch');
//    }
//    
//    if (this._imageDataContext.isDisposed()) {
//        throw new jGlobals.jpipExceptions.IllegalOperationException(
//            'Cannot fetch data with disposed imageDataContext');
//    }
//    
//    if (this._isMoved) {
//        throw new jGlobals.jpipExceptions.IllegalOperationException(
//            'Cannot resume movable fetch which has been already moved; Should' +
//            ' start a new fetch with same dedicatedChannelHandle instead');
//    }
//    
//    this._requestData();
//};
//
//JpipFetchHandle.prototype.stopAsync = function stopAsync() {
//    if (this._serverRequest === null) {
//        if (this._imageDataContext.isDisposed() || this._imageDataContext.isDone()) {
//            return;
//        }
//        throw new jGlobals.jpipExceptions.IllegalOperationException(
//            'Cannot stop already stopped fetch');
//    }
//    
//    if (this._dedicatedChannelHandle) {
//        this._isMoved = true;
//    } else {
//        this._requester.stopRequestAsync(this._serverRequest);
//        this._serverRequest = null;
//    }
//    
//    return new Promise(function(resolve, reject) {
//        // NOTE: Send a stop request within JpipRequest and resolve the Promise
//        // only after server response (This is only performance issue, no
//        // functional problem: a new fetch will trigger a JPIP request with
//        // wait=no, and the old request will be actually stopped).
//        resolve();
//    });
//};
//
//JpipFetchHandle.prototype._requesterCallbackOnAllDataRecieved =
//    function (request, isResponseDone, requestedQualityLayer) {
//    
//    if (isResponseDone &&
//        !this._isMoved &&
//        !this._imageDataContext.isDisposed() &&
//        requestedQualityLayer > this._reachedQualityLayer) {
//            
//        throw new jGlobals.jpipExceptions.IllegalDataException(
//            'JPIP server not returned all data', 'D.3');
//    }
//};
//
//JpipFetchHandle.prototype._requesterCallbackOnFailure =
//    function requesterCallbackOnFailure() {
//        
//    //updateStatus(STATUS_ENDED, 'endAsync()');
//    
//    //if (failureCallback !== undefined) {
//    //    failureCallback(self, userContextVars);
//    //} else {
//    //    isFailure = true;
//    //}
//    this._isFailure = true;
//
//    if (this._isMoved) {
//        throw new jGlobals.jpipExceptions.InternalErrorException(
//            'Failure callback to an old fetch which has been already moved');
//    }
//};
//
//JpipFetchHandle.prototype._onData = function onData(imageDataContext) {
//    this._reachedQualityLayer = this._requestedQualityLayer;
//    
//    if (imageDataContext !== this._imageDataContext) {
//        throw new jGlobals.jpipExceptions.InternalErrorException(
//            'Unexpected ImageDataContext in FetchHandle event');
//    }
//    
//    if (!this._isMoved &&
//        !this._imageDataContext.isDisposed() &&
//        this._serverRequest !== null) {
//        
//        this._requestData();
//    }
//};
//
//JpipFetchHandle.prototype._requestData = function requestData() {
//    if (this._imageDataContext.isDone()) {
//        return;
//    }
//    
//    var self = this;
//    var numQualityLayersToWait = this._imageDataContext.getNextQualityLayer();
//    this._requestedQualityLayer = numQualityLayersToWait;
//        
//    this._serverRequest = this._requester.requestData(
//        this._imageDataContext.getCodestreamPartParams(),
//        function allDataRecieved(request, isResponseDone) {
//            self._requesterCallbackOnAllDataRecieved(
//                request, isResponseDone, numQualityLayersToWait);
//        },
//        this._requesterCallbackOnFailureBound,
//        numQualityLayersToWait,
//        this._dedicatedChannelHandle);
//};
},{"j2k-jpip-globals.js":16}],2:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');
var jpipFactory = require('jpip-runtime-factory.js'); 

module.exports = JpipFetcher;

function JpipFetcher(databinsSaver, options) {
    options = options || {};

    var isOpenCalled = false;
    var resolveOpen = null;
    var rejectOpen = null;
    var progressionOrder = 'RPCL';

    var maxChannelsInSession = options.maxChannelsInSession || 1;
    var maxRequestsWaitingForResponseInChannel =
        options.maxRequestsWaitingForResponseInChannel || 1;

    //var databinsSaver = jpipFactory.createDatabinsSaver(/*isJpipTilepartStream=*/false);
    var mainHeaderDatabin = databinsSaver.getMainHeaderDatabin();

    var markersParser = jpipFactory.createMarkersParser(mainHeaderDatabin);
    var offsetsCalculator = jpipFactory.createOffsetsCalculator(
        mainHeaderDatabin, markersParser);
    var structureParser = jpipFactory.createStructureParser(
        databinsSaver, markersParser, offsetsCalculator);
    var codestreamStructure = jpipFactory.createCodestreamStructure(
        structureParser, progressionOrder);

    var requester = jpipFactory.createReconnectableRequester(
        maxChannelsInSession,
        maxRequestsWaitingForResponseInChannel,
        codestreamStructure,
        databinsSaver);

    var paramsModifier = jpipFactory.createRequestParamsModifier(codestreamStructure);

    requester.setStatusCallback(requesterStatusCallback);
    
    this.open = function open(baseUrl) {
        if (isOpenCalled) {
            throw 'webJpip error: Cannot call JpipFetcher.open() twice';
        }
        
        return new Promise(function(resolve, reject) {
            resolveOpen = resolve;
            rejectOpen = reject;
            requester.open(baseUrl);
        });
    };
    
    this.close = function close() {
        return new Promise(function(resolve, reject) {
            requester.close(resolve);
        });
    };
    
    this.on = function on() {
        // TODO When JpipFetcher is fully aligned to imageDecoderFramework new API
    };

    this.startFetch = function startFetch(fetchContext, codestreamPartParams) {
        var params = paramsModifier.modify(codestreamPartParams);
        var fetch = createFetch(fetchContext, params.progressiveness);
        
        fetch.move(params.codestreamPartParams);
    };

    this.startMovableFetch = function startMovableFetch(fetchContext, codestreamPartParams) {
        var params = paramsModifier.modify(codestreamPartParams);
        var fetch = createFetch(fetchContext, params.progressiveness);

        var dedicatedChannelHandle = requester.dedicateChannelForMovableRequest();
        fetch.setDedicatedChannelHandle(dedicatedChannelHandle);
        fetchContext.on('move', fetch.move);

        fetch.move(params.codestreamPartParams);
    };
    
    function createFetch(fetchContext, progressiveness) {
        //var imageDataContext = jpipFactory.createImageDataContext(
        //    jpipObjectsForRequestContext,
        //    codestreamPartParamsModified,
        //    progressivenessModified);
        //    //{
        //    //    disableServerRequests: !!options.isOnlyWaitForData,
        //    //    isMovable: false,
        //    //    userContextVars: userContextVars,
        //    //    failureCallback: options.failureCallback
        //    //});
        
        var fetch = jpipFactory.createFetch(fetchContext, requester, progressiveness);

        fetchContext.on('isProgressiveChanged', fetch.isProgressiveChanged);
        fetchContext.on('terminate', fetch.terminate);
        fetchContext.on('stop', fetch.stop);
        fetchContext.on('resume', fetch.resum);
        
        return fetch;
    }
    
    //this.startMovableFetch = function startMovableFetch(imageDataContext, movableFetchState) {
    //    movableFetchState.dedicatedChannelHandle =
    //        requester.dedicateChannelForMovableRequest();
    //    movableFetchState.fetchHandle = jpipFactory.createFetchHandle(
    //        requester, imageDataContext, movableFetchState.dedicatedChannelHandle);
    //    movableFetchState.fetchHandle.resume();
    //};
    //
    //this.moveFetch = function moveFetch(imageDataContext, movableFetchState) {
    //    movableFetchState.fetchHandle.stopAsync();
    //    movableFetchState.fetchHandle = jpipFactory.createFetchHandle(
    //        requester, imageDataContext, movableFetchState.dedicatedChannelHandle);
    //    movableFetchState.fetchHandle.resume();
    //};
    
    this.reconnect = function reconnect() {
        requester.reconnect();
    };
    
    function requesterStatusCallback(requesterStatus) {
        var serializableException = null;
        if (requesterStatus.exception !== null) {
            serializableException = requesterStatus.exception.toString();
        }
        
        var status = {
            isReady: requesterStatus.isReady,
            exception: serializableException
            };
        
        if (!resolveOpen || (!status.isReady && !status.exception)) {
            return;
        }
        
        var localResolve = resolveOpen;
        var localReject = rejectOpen;
        resolveOpen = null;
        rejectOpen = null;

        if (!status.isReady) {
            localReject(status.exception);
            return;
        }
        
        var params = codestreamStructure.getSizesParams();
        var clonedParams = JSON.parse(JSON.stringify(params));
        
        var tile = codestreamStructure.getDefaultTileStructure();
        var component = tile.getDefaultComponentStructure();

        clonedParams.imageLevel = 0;
        clonedParams.lowestQuality = 1;
        clonedParams.highestQuality = tile.getNumQualityLayers();
        clonedParams.numResolutionLevelsForLimittedViewer =
            component.getNumResolutionLevels();
        
        localResolve(clonedParams);
    }
    
    return this;
}
},{"j2k-jpip-globals.js":16,"jpip-runtime-factory.js":17}],3:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = JpipImageDataContext;

function JpipImageDataContext(jpipObjects, codestreamPartParams, progressiveness) {
    this._codestreamPartParams = codestreamPartParams;
    this._progressiveness      = progressiveness;
    this._reconstructor        = jpipObjects.reconstructor;
    this._packetsDataCollector = jpipObjects.packetsDataCollector;
    this._qualityLayersCache   = jpipObjects.qualityLayersCache;
    this._codestreamStructure  = jpipObjects.codestreamStructure;
    this._databinsSaver        = jpipObjects.databinsSaver;
    this._jpipFactory          = jpipObjects.jpipFactory;

    this._progressiveStagesFinished = 0;
    this._qualityLayersReached = 0;
    this._dataListeners = [];
    
    this._listener = this._jpipFactory.createRequestDatabinsListener(
        codestreamPartParams,
        this._qualityLayerReachedCallback.bind(this),
        this._codestreamStructure,
        this._databinsSaver,
        this._qualityLayersCache);
}

JpipImageDataContext.prototype.hasData = function hasData() {
    //ensureNoFailure();
    this._ensureNotDisposed();
    return this._progressiveStagesFinished > 0;
};

JpipImageDataContext.prototype.getFetchedData = function getFetchedData(quality) {
    this._ensureNotDisposed();
    if (!this.hasData()) {
        throw 'JpipImageDataContext error: cannot call getFetchedData before hasData = true';
    }
    
    //ensureNoFailure();
    var params = this._getParamsForDataWriter(quality);
    var codeblocks = this._packetsDataCollector.getAllCodeblocksData(
        params.codestreamPartParams,
        params.minNumQualityLayers);
    
    var headersCodestream = this._reconstructor.createCodestreamForRegion(
        params.codestreamPartParams,
        params.minNumQualityLayers,
        /*isOnlyHeadersWithoutBitstream=*/true);
    
    if (codeblocks.codeblocksData === null) {
        throw new jGlobals.jpipExceptions.InternalErrorException(
            'Could not collect codeblocks although progressiveness ' +
            'stage has been reached');
    }
    
    if (headersCodestream === null) {
        throw new jGlobals.jpipExceptions.InternalErrorException(
            'Could not reconstruct codestream although ' +
            'progressiveness stage has been reached');
    }
    
    //alreadyReturnedCodeblocks = codeblocks.alreadyReturnedCodeblocks;
    return {
        headersCodestream: headersCodestream,
        codeblocksData: codeblocks.codeblocksData,
        codestreamPartParams: this._codestreamPartParams
    };
};

JpipImageDataContext.prototype.getFetchedDataAsCodestream = function getFetchedDataAsCodestream(quality) {
    this._ensureNotDisposed();
    //ensureNoFailure();
    
    var params = this._getParamsForDataWriter(quality);
    
    var codestream = this._reconstructor.createCodestreamForRegion(
        params.codestreamPartParams,
        params.minNumQualityLayers);
    
    if (codestream === null) {
        throw new jGlobals.jpipExceptions.InternalErrorException(
            'Could not reconstruct codestream although ' +
            'progressiveness stage has been reached');
    }
    
    return codestream;
};

JpipImageDataContext.prototype.on = function on(event, listener) {
    this._ensureNotDisposed();
    if (event !== 'data') {
        throw 'JpipImageDataContext error: Unexpected event ' + event;
    }
    
    this._dataListeners.push(listener);
};

JpipImageDataContext.prototype.isDone = function isDone() {
    this._ensureNotDisposed();
    return this._isRequestDone;
};

JpipImageDataContext.prototype.dispose = function dispose() {
    this._ensureNotDisposed();
    this._listener.unregister();
    this._listener = null;
};

JpipImageDataContext.prototype.setIsProgressive = function setIsProgressive(isProgressive) {
    this._ensureNotDisposed();
    var oldIsProgressive = this._isProgressive;
    this._isProgressive = isProgressive;
    if (!oldIsProgressive && isProgressive && this.hasData()) {
        for (var i = 0; i < this._dataListeners.length; ++i) {
            this._dataListeners[i](this);
        }
    }
};

// Methods for JpipFetchHandle

JpipImageDataContext.prototype.isDisposed = function isDisposed() {
    return !this._listener;
};

JpipImageDataContext.prototype.getCodestreamPartParams =
    function getCodestreamPartParams() {
        
    return this._codestreamPartParams;
};

JpipImageDataContext.prototype.getNextQualityLayer =
    function getNextQualityLayer() {
        
    return this._progressiveness[this._progressiveStagesFinished].minNumQualityLayers;
};

// Private methods

JpipImageDataContext.prototype._tryAdvanceProgressiveStage = function tryAdvanceProgressiveStage() {
    var numQualityLayersToWait = this._progressiveness[
        this._progressiveStagesFinished].minNumQualityLayers;

    if (this._qualityLayersReached < numQualityLayersToWait) {
        return false;
    }
    
    if (this._qualityLayersReached === 'max') {
        this._progressiveStagesFinished = this._progressiveness.length;
    }
    
    while (this._progressiveStagesFinished < this._progressiveness.length) {
        var qualityLayersRequired = this._progressiveness[
            this._progressiveStagesFinished].minNumQualityLayers;
        
        if (qualityLayersRequired === 'max' ||
            qualityLayersRequired > this._qualityLayersReached) {
            
            break;
        }
        
        ++this._progressiveStagesFinished;
    }
    
    this._isRequestDone = this._progressiveStagesFinished === this._progressiveness.length;

    return true;
};

JpipImageDataContext.prototype._qualityLayerReachedCallback = function qualityLayerReachedCallback(qualityLayersReached) {
    this._qualityLayersReached = qualityLayersReached;
    
    if (this._isRequestDone) {
        throw new jGlobals.jpipExceptions.InternalErrorException(
            'Request already done but callback is called');
    }
    
    if (!this._tryAdvanceProgressiveStage()) {
        return;
    }
    
    if (!this._isProgressive && !this._isRequestDone) {
        return;
    }
    
    for (var i = 0; i < this._dataListeners.length; ++i) {
        this._dataListeners[i](this);
    }
};

JpipImageDataContext.prototype._getParamsForDataWriter = function getParamsForDataWriter(quality) {
    //ensureNotEnded(status, /*allowZombie=*/true);
    
    //if (codestreamPartParams === null) {
    //    throw new jGlobals.jpipExceptions.IllegalOperationException('Cannot ' +
    //        'get data of zombie request with no codestreamPartParams');
    //}
    
    //var isRequestDone = progressiveStagesFinished === progressiveness.length;
    //if (!isRequestDone) {
    //    ensureNotWaitingForUserInput(status);
    //}
    
    if (this._progressiveStagesFinished === 0) {
        throw new jGlobals.jpipExceptions.IllegalOperationException(
            'Cannot create codestream before first progressiveness ' +
            'stage has been reached');
    }
    
    var minNumQualityLayers =
        this._progressiveness[this._progressiveStagesFinished - 1].minNumQualityLayers;
    
    var newParams = this._codestreamPartParams;
    if (quality !== undefined) {
        newParams = Object.create(this._codestreamPartParams);
        newParams.quality = quality;
        
        if (minNumQualityLayers !== 'max') {
            minNumQualityLayers = Math.min(
                minNumQualityLayers, quality);
        }
    }
    
    return {
        codestreamPartParams: newParams,
        minNumQualityLayers: minNumQualityLayers
        };
};

JpipImageDataContext.prototype._ensureNotDisposed = function ensureNotDisposed() {
    if (this.isDisposed()) {
        throw new jGlobals.jpipExceptions.IllegalOperationException('Cannot use ImageDataContext after disposed');
    }
};

},{"j2k-jpip-globals.js":16}],4:[function(require,module,exports){
'use strict';

var jpipFactory = require('jpip-runtime-factory.js'); 

module.exports = JpipImage;

function JpipImage(options) {
    var databinsSaver = jpipFactory.createDatabinsSaver(/*isJpipTilepartStream=*/false);
    var mainHeaderDatabin = databinsSaver.getMainHeaderDatabin();

    var markersParser = jpipFactory.createMarkersParser(mainHeaderDatabin);
    var offsetsCalculator = jpipFactory.createOffsetsCalculator(
        mainHeaderDatabin, markersParser);
    var structureParser = jpipFactory.createStructureParser(
        databinsSaver, markersParser, offsetsCalculator);
    
    var progressionOrder = 'RPCL';
    var codestreamStructure = jpipFactory.createCodestreamStructure(
        structureParser, progressionOrder);
    
    var qualityLayersCache = jpipFactory.createQualityLayersCache(
        codestreamStructure);
        
    var headerModifier = jpipFactory.createHeaderModifier(
        codestreamStructure, offsetsCalculator, progressionOrder);
    var reconstructor = jpipFactory.createCodestreamReconstructor(
        codestreamStructure, databinsSaver, headerModifier, qualityLayersCache);
    var packetsDataCollector = jpipFactory.createPacketsDataCollector(
        codestreamStructure, databinsSaver, qualityLayersCache);
    
    var jpipObjectsForRequestContext = {
        reconstructor: reconstructor,
        packetsDataCollector: packetsDataCollector,
        qualityLayersCache: qualityLayersCache,
        codestreamStructure: codestreamStructure,
        databinsSaver: databinsSaver,
        jpipFactory: jpipFactory
    };
    
    var paramsModifier = jpipFactory.createRequestParamsModifier(codestreamStructure);

    var imageParams = null;
    var levelCalculator = null;
    
    var fetcher = jpipFactory.createFetcher(databinsSaver, options); // TODO: WorkerProxyFetcher
    //function GridImageBase() {
    //    this._fetcher = fetcher;
    //    this._imageParams = null;
    //    this._waitingFetches = {};
    //    this._levelCalculator = null;
    //}

    this.opened = function opened(imageDecoder) {
        imageParams = imageDecoder.getImageParams();
        //imageDecoder.onFetcherEvent('data', this._onDataFetched.bind(this));
        //imageDecoder.onFetcherEvent('tile-terminated', this._onTileTerminated.bind(this));
    };

    this.getLevelCalculator = function getLevelCalculator() {
        if (levelCalculator === null) {
            levelCalculator = jpipFactory.createLevelCalculator(imageParams);
        }
        return levelCalculator;
    };

    this.getDecoderWorkersInputRetreiver = function getDecoderWorkersInputRetreiver() {
        return this;
    };
    
    this.getFetcher = function getFetcher() {
        return fetcher;
    };

    this.getWorkerTypeOptions = function getWorkerTypeOptions(taskType) {
        return {
            ctorName: 'webjpip.PdfjsJpxDecoder',
            ctorArgs: [],
            scriptsToImport: [getScriptName(new Error())]
        };
    };

    this.getKeyAsString = function getKeyAsString(key) {
        return JSON.stringify(key);
    };

    this.taskStarted = function taskStarted(task) {
        var params = paramsModifier.modify(/*codestreamTaskParams=*/task.key);
        var context = jpipFactory.createImageDataContext(
            jpipObjectsForRequestContext,
            params.codestreamPartParams,
            params.progressiveness);
        
        context.on('data', onData);
        if (context.hasData()) {
            onData(context);
        }
        
        function onData(context_) {
            if (context !== context_) {
                throw 'webjpip error: Unexpected context in data event';
            }
            
            // TODO: First quality layer
            var data = context.getFetchedData();
            task.dataReady(data);
            
            if (context.isDone()) {
                task.terminate();
                context.dispose();
            }
        }
    };
}

function getScriptName(errorWithStackTrace) {
    var stack = errorWithStackTrace.stack.trim();
    
    var currentStackFrameRegex = /at (|[^ ]+ \()([^ ]+):\d+:\d+/;
    var source = currentStackFrameRegex.exec(stack);
    if (source && source[2] !== "") {
        return source[2];
    }

    var lastStackFrameRegex = new RegExp(/.+\/(.*?):\d+(:\d+)*$/);
    source = lastStackFrameRegex.exec(stack);
    if (source && source[1] !== "") {
        return source[1];
    }
    
    if (errorWithStackTrace.fileName !== undefined) {
        return errorWithStackTrace.fileName;
    }
    
    throw 'ImageDecoderFramework.js: Could not get current script URL';
}
},{"jpip-runtime-factory.js":17}],5:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');
var LOG2 = Math.log(2);

module.exports = function JpipLevelCalculator(
    params) {
    
    var EDGE_TYPE_NO_EDGE = 0;
    var EDGE_TYPE_FIRST = 1;
    var EDGE_TYPE_LAST = 2;

    this.EDGE_TYPE_NO_EDGE = EDGE_TYPE_NO_EDGE;
    this.EDGE_TYPE_FIRST = EDGE_TYPE_FIRST;
    this.EDGE_TYPE_LAST = EDGE_TYPE_LAST;
    
    this.getSizeOfPart = getSizeOfPart;
    
    this.getTilesFromPixels = getTilesFromPixels;
    
    this.getNumTilesX = getNumTilesX;
    
    this.getNumTilesY = getNumTilesY;
    
    this.getTileWidth = getTileWidth;
    
    this.getTileHeight = getTileHeight;
    
    this.getFirstTileOffsetX = getFirstTileOffsetX;
    
    this.getFirstTileOffsetY = getFirstTileOffsetY;
    
    this.getFirstTileWidth = getFirstTileWidth;
    
    this.getFirstTileHeight = getFirstTileHeight;
    
    this.isEdgeTileId = isEdgeTileId;
    
    this.getTileSize = getTileSize;
    
    // Public methods for imageDecoderFramework.js
    
    this.getLevelWidth = getLevelWidth;
    
    this.getLevelHeight = getLevelHeight;
    
    this.getImageLevel = function getImageLevel() {
        return 0;
    };
    
    this.getLevel = function getLevel(regionImageLevel) {
        if (params.numResolutionLevelsForLimittedViewer === undefined) {
            throw 'This method is available only when jpipSizesCalculator ' +
                'is created from params returned by jpipCodestreamClient. ' +
                'It shall be used for JPIP API purposes only';
        }
        
        var levelX = Math.log((regionImageLevel.maxXExclusive - regionImageLevel.minX) / regionImageLevel.screenWidth ) / LOG2;
        var levelY = Math.log((regionImageLevel.maxYExclusive - regionImageLevel.minY) / regionImageLevel.screenHeight) / LOG2;
        var level = Math.ceil(Math.max(levelX, levelY));
        level = Math.max(0, Math.min(params.numResolutionLevelsForLimittedViewer - 1, level));
        return level;
    };
    
    this.getNumResolutionLevelsForLimittedViewer =
        function getNumResolutionLevelsForLimittedViewer() {
        
        if (params.numResolutionLevelsForLimittedViewer === undefined) {
            throw 'This method is available only when jpipSizesCalculator ' +
                'is created from params returned by jpipCodestreamClient. ' +
                'It shall be used for JPIP API purposes only';
        }
        
        return params.numResolutionLevelsForLimittedViewer;
    };
    
    this.getLowestQuality = function getLowestQuality() {
        return 1;
    };
    
    this.getHighestQuality = function getHighestQuality() {
        if (params.highestQuality === undefined) {
            throw 'This method is available only when jpipSizesCalculator ' +
                'is created from params returned by jpipCodestreamClient. ' +
                'It shall be used for JPIP API purposes only';
        }
        
        return params.highestQuality;
    };
    
    // Private methods
    
    function getSizeOfPart(codestreamPartParams) {
        var level =
            codestreamPartParams.level;
        var tileWidth = getTileWidth(level);
        var tileHeight = getTileHeight(level);
        
        var tileBounds = getTilesFromPixels(codestreamPartParams);
        
        var firstTileIndex =
            tileBounds.minTileX + tileBounds.minTileY * getNumTilesX();
            
        var lastTileIndex =
            (tileBounds.maxTileXExclusive - 1) +
            (tileBounds.maxTileYExclusive - 1) * getNumTilesX();
        
        var firstEdgeType = isEdgeTileId(firstTileIndex);
        var lastEdgeType = isEdgeTileId(lastTileIndex);
        var firstSize = getTileSize(firstEdgeType, level);
        var lastSize = getTileSize(lastEdgeType, level);
        
        var width = firstSize[0];
        var height = firstSize[1];

        var tilesX = tileBounds.maxTileXExclusive - tileBounds.minTileX;
        var tilesY = tileBounds.maxTileYExclusive - tileBounds.minTileY;
        
        if (tilesX > 1) {
            width += lastSize[0];
            width += tileWidth * (tilesX - 2);
        }
        
        if (tilesY > 1) {
            height += lastSize[1];
            height += tileHeight * (tilesY - 2);
        }
        
        return {
            width: width,
            height: height
            };
    }
    
    function getTilesFromPixels(partParams) {
        var level =
            partParams.level;

        var tileWidth = getTileWidth(level);
        var tileHeight = getTileHeight(level);
        
        var firstTileWidth = getFirstTileWidth(level);
        var firstTileHeight = getFirstTileHeight(level);
        
        var startXNoFirst = (partParams.minX - firstTileWidth) / tileWidth;
        var startYNoFirst = (partParams.minY - firstTileHeight) / tileHeight;
        var endXNoFirst = (partParams.maxXExclusive - firstTileWidth) / tileWidth;
        var endYNoFirst = (partParams.maxYExclusive - firstTileHeight) / tileHeight;
        
        var minTileX = Math.max(0, 1 + startXNoFirst);
        var minTileY = Math.max(0, 1 + startYNoFirst);
        var maxTileX = Math.min(getNumTilesX(), 1 + endXNoFirst);
        var maxTileY = Math.min(getNumTilesY(), 1 + endYNoFirst);

        var bounds = {
            minTileX: Math.floor(minTileX),
            minTileY: Math.floor(minTileY),
            maxTileXExclusive: Math.ceil(maxTileX),
            maxTileYExclusive: Math.ceil(maxTileY)
            };
        
        return bounds;
    }

    function getTileSize(edgeType, level) {
        var tileWidth = getTileDimensionSize(
            edgeType.horizontalEdgeType,
            getFirstTileWidth,
            getLevelWidth,
            getTileWidth);
        
        var tileHeight = getTileDimensionSize(
            edgeType.verticalEdgeType,
            getFirstTileHeight,
            getLevelHeight,
            getTileHeight);
        
        if (level !== undefined) {
            var scale = 1 << level;
            tileWidth = Math.ceil(tileWidth / scale);
            tileHeight = Math.ceil(tileHeight / scale);
        }
        
        return [tileWidth, tileHeight];
    }

    function getTileDimensionSize(
        edgeType, getFirstTileSize, getLevelSize, getNonEdgeTileSize) {
        
        var result;
        
        switch (edgeType) {
            case EDGE_TYPE_FIRST:
                result = getFirstTileSize();
                break;
            
            case EDGE_TYPE_LAST:
                var nonEdgeTileSize = getNonEdgeTileSize();
                var widthWithoutFirst = getLevelSize() - getFirstTileSize();
                result = widthWithoutFirst % nonEdgeTileSize;
                
                if (result === 0) {
                    result = nonEdgeTileSize;
                }
                
                break;
            
            case EDGE_TYPE_NO_EDGE:
                result = getNonEdgeTileSize();
                break;
            
            default:
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Unexpected edge type: ' + edgeType);
        }
        
        return result;
    }
    function isEdgeTileId(tileId) {
        var numTilesX = getNumTilesX();
        var numTilesY = getNumTilesY();
        
        var tileX = tileId % numTilesX;
        var tileY = Math.floor(tileId / numTilesX);
        
        if (tileY > numTilesY || tileX < 0 || tileY < 0) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Tile index ' + tileId + ' is not in range');
        }
        
        var horizontalEdge =
            tileX === 0 ? EDGE_TYPE_FIRST :
            tileX === (numTilesX - 1) ? EDGE_TYPE_LAST :
            EDGE_TYPE_NO_EDGE;
        
        var verticalEdge =
            tileY === 0 ? EDGE_TYPE_FIRST :
            tileY === (numTilesY - 1) ? EDGE_TYPE_LAST :
            EDGE_TYPE_NO_EDGE;
        
        var result = {
            horizontalEdgeType: horizontalEdge,
            verticalEdgeType: verticalEdge
            };
        
        return result;
    }

    function getNumTilesX() {
        var numTilesX = Math.ceil(params.imageWidth / params.tileWidth);
        return numTilesX;
    }
    
    function getNumTilesY() {
        var numTilesY = Math.ceil(params.imageHeight / params.tileHeight);
        return numTilesY;
    }
    
    function getLevelWidth(level) {
        if (level === undefined) {
            return params.imageWidth;
        }
        
        var size = getSizeOfPart({
            minX: 0,
            maxXExclusive: params.imageWidth,
            minY: 0,
            maxYExclusive: params.imageHeight,
            level: level
            });
        
        return size.width;
    }
    
    function getLevelHeight(level) {
        if (level === undefined) {
            return params.imageHeight;
        }
        
        var size = getSizeOfPart({
            minX: 0,
            maxXExclusive: params.imageWidth,
            minY: 0,
            maxYExclusive: params.imageHeight,
            level: level
            });
        
        return size.height;
    }

    function getTileWidth(level) {
        if (level === undefined) {
            return params.tileWidth;
        }
    
        var scale = 1 << level;
        var width = Math.ceil(params.tileWidth / scale);
        return width;
    }
    
    function getTileHeight(level) {
        if (level === undefined) {
            return params.tileHeight;
        }
    
        var scale = 1 << level;
        var height = Math.ceil(params.tileHeight / scale);
        return height;
    }
    
    function getFirstTileOffsetX() {
        return params.firstTileOffsetX;
    }
    
    function getFirstTileOffsetY() {
        return params.firstTileOffsetY;
    }

    function getFirstTileWidth(level) {
        var firstTileWidthBestLevel =
            getTileWidth() - getFirstTileOffsetX();
        
        var imageWidth = getLevelWidth();
        if (firstTileWidthBestLevel > imageWidth) {
            firstTileWidthBestLevel = imageWidth;
        }
        
        var scale = 1 << level;
        var firstTileWidth = Math.ceil(firstTileWidthBestLevel / scale);
        
        return firstTileWidth;
    }
    
    function getFirstTileHeight(level) {
        var firstTileHeightBestLevel =
            getTileHeight() - getFirstTileOffsetY();
        
        var imageHeight = getLevelHeight();
        if (firstTileHeightBestLevel > imageHeight) {
            firstTileHeightBestLevel = imageHeight;
        }
        
        var scale = 1 << level;
        var firstTileHeight = Math.ceil(firstTileHeightBestLevel / scale);

        return firstTileHeight;
    }

    return this;
};
},{"j2k-jpip-globals.js":16}],6:[function(require,module,exports){
'use strict';

module.exports = PdfjsJpxDecoder;

var jGlobals = require('j2k-jpip-globals.js');

function PdfjsJpxDecoder() {
    this._image = new JpxImage();
}

PdfjsJpxDecoder.prototype.start = function start(data) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var regionToParse = {
            left  : data.headersCodestream.offsetX,
            top   : data.headersCodestream.offsetY,
            right : data.headersCodestream.offsetX + data.codestreamPartParams.maxXExclusive - data.codestreamPartParams.minX,
            bottom: data.headersCodestream.offsetY + data.codestreamPartParams.maxYExclusive - data.codestreamPartParams.minY
        };
        
        var currentContext = self._image.parseCodestream(
            data.headersCodestream.codestream,
            0,
            data.headersCodestream.codestream.length,
            { isOnlyParseHeaders: true });
        
        self._image.addPacketsData(currentContext, data.codeblocksData);
        
        self._image.decode(currentContext, { regionToParse: regionToParse });

        var result = self._copyTilesPixelsToOnePixelsArray(self._image.tiles, regionToParse, self._image.componentsCount);
        resolve(result);
    });
};

PdfjsJpxDecoder.prototype._copyTilesPixelsToOnePixelsArray =
    function copyTilesPixelsToOnePixelsArray(tiles, resultRegion, componentsCount) {
        
    var firstTile = tiles[0];
    var width = resultRegion.right - resultRegion.left;
    var height = resultRegion.bottom - resultRegion.top;
    
    //if (firstTile.left === resultRegion.left &&
    //    firstTile.top === resultRegion.top &&
    //    firstTile.width === width &&
    //    firstTile.height === height &&
    //    componentsCount === 4) {
    //    
    //    return firstTile;
    //}
    
    var result = new ImageData(width, height);
      
    var bytesPerPixel = 4;
    var rgbaImageStride = width * bytesPerPixel;
    
    var tileIndex = 0;
    
    //for (var x = 0; x < numTilesX; ++x) {

    for (var i = 0; i < tiles.length; ++i) {
        var tileRight = tiles[i].left + tiles[i].width;
        var tileBottom = tiles[i].top + tiles[i].height;
        
        var intersectionLeft = Math.max(resultRegion.left, tiles[i].left);
        var intersectionTop = Math.max(resultRegion.top, tiles[i].top);
        var intersectionRight = Math.min(resultRegion.right, tileRight);
        var intersectionBottom = Math.min(resultRegion.bottom, tileBottom);
        
        var intersectionWidth = intersectionRight - intersectionLeft;
        var intersectionHeight = intersectionBottom - intersectionTop;
        
        if (intersectionLeft !== tiles[i].left ||
            intersectionTop !== tiles[i].top ||
            intersectionWidth !== tiles[i].width ||
            intersectionHeight !== tiles[i].height) {
            
            throw 'Unsupported tiles to copy';
        }
        
        var tileOffsetXPixels = intersectionLeft - resultRegion.left;
        var tileOffsetYPixels = intersectionTop - resultRegion.top;
            
        var tileOffsetBytes =
            tileOffsetXPixels * bytesPerPixel +
            tileOffsetYPixels * rgbaImageStride;

        this._copyTile(
            result.data, tiles[i], tileOffsetBytes, rgbaImageStride, componentsCount);
    }
    
    return result;
};

PdfjsJpxDecoder.prototype._copyTile = function copyTile(
    targetImage, tile, targetImageStartOffset, targetImageStride, componentsCount) {
    
    var rOffset = 0;
    var gOffset = 1;
    var bOffset = 2;
    var pixelsOffset = 1;
    
    var pixels = tile.pixels || tile.items;
    
    if (componentsCount === undefined) {
        componentsCount = pixels.length / (tile.width * tile.height);
    }
    
    switch (componentsCount) {
        case 1:
            gOffset = 0;
            bOffset = 0;
            break;
        
        case 3:
            pixelsOffset = 3;
            break;
            
        case 4:
            pixelsOffset = 4;
            break;
            
        default:
            throw 'Unsupported components count ' + componentsCount;
    }
    
    var targetImageIndex = targetImageStartOffset;
    var pixel = 0;
    for (var y = 0; y < tile.height; ++y) {
        var targetImageStartLine = targetImageIndex;
        
        for (var x = 0; x < tile.width; ++x) {
            targetImage[targetImageIndex + 0] = pixels[pixel + rOffset];
            targetImage[targetImageIndex + 1] = pixels[pixel + gOffset];
            targetImage[targetImageIndex + 2] = pixels[pixel + bOffset];
            targetImage[targetImageIndex + 3] = 255;
            
            pixel += pixelsOffset;
            targetImageIndex += 4;
        }
        
        targetImageIndex = targetImageStartLine + targetImageStride;
    }
};
},{"j2k-jpip-globals.js":16}],7:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function CompositeArray(offset) {
    var length = 0;
    var internalParts = [];
    
    this.getLength = function getLength() {
        return length;
    };

    this.getOffset = function getOffset() {
        return offset;
    };
        
    this.pushSubArray = function pushSubArray(subArray) {
        internalParts.push(subArray);
        length += subArray.length;
    };
    
    this.copyToOtherAtTheEnd = function copyToOtherAtTheEnd(result, minOffset, maxOffset) {
        checkOffsetsToCopy(minOffset, maxOffset);
        
        var iterator = getInternalPartsIterator(minOffset, maxOffset);
        
        // NOTE: What if data not in first part?
        
        while (tryAdvanceIterator(iterator)) {
            result.pushSubArray(iterator.subArray);
        }
    };

    this.copyToTypedArray = function copyToTypedArray(
        resultArray, resultArrayOffset, minOffset, maxOffset) {
        
        checkOffsetsToCopy(minOffset, maxOffset);
        
        var iterator = getInternalPartsIterator(minOffset, maxOffset);
        
        // NOTE: What if data not in first part?
        
        while (tryAdvanceIterator(iterator)) {
            var offsetInResult =
                iterator.offset - resultArrayOffset;
            
            resultArray.set(iterator.subArray, offsetInResult);
        }
    };

    this.copyToArray = function copyToArray(
        resultArray, resultArrayOffset, minOffset, maxOffset) {
        
        checkOffsetsToCopy(minOffset, maxOffset);
        
        var iterator = getInternalPartsIterator(minOffset, maxOffset);
        
        // NOTE: What if data not in first part?
        
        while (tryAdvanceIterator(iterator)) {
            var offsetInResult =
                iterator.offset - resultArrayOffset;
            
            for (var j = 0; j < iterator.subArray.length; ++j) {
                resultArray[offsetInResult++] = iterator.subArray[j];
            }
        }
    };
    
    this.copyToOther = function copyToOther(other) {
        if (other.getOffset() > offset) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'CompositeArray: Trying to copy part into a latter part');
        }
        
        var otherEndOffset = other.getOffset() + other.getLength();
        var isOtherContainsThis = offset + length <= otherEndOffset;
        if (isOtherContainsThis) {
            return;
        }
    
        // Do not override already exist data (for efficiency)
        var minOffset = otherEndOffset;
        
        var iterator = getInternalPartsIterator(minOffset);
        
        if (!tryAdvanceIterator(iterator)) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'CompositeArray: Could not merge parts');
        }
        
        var expectedOffsetValue = minOffset;

        do {
            if (iterator.offset !== expectedOffsetValue) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'CompositeArray: Non-continuous value of ' +
                    'rangeToCopy.offset. Expected: ' + expectedOffsetValue +
                     ', Actual: ' + iterator.offset);
            }
            
            other.pushSubArray(iterator.subArray);
            expectedOffsetValue += iterator.subArray.length;
        } while (tryAdvanceIterator(iterator));
    };
    
    function checkOffsetsToCopy(minOffset, maxOffset) {
        if (minOffset === undefined || maxOffset === undefined) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'minOffset or maxOffset is undefined for CompositeArray.copyToArray');
        }
        
        if (minOffset < offset) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'minOffset (' + minOffset + ') must be smaller than ' +
                'CompositeArray offset (' + offset + ')');
        }
        
        if (maxOffset > offset + length) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'maxOffset (' + maxOffset + ') must be larger than ' +
                'CompositeArray end offset (' + offset + length + ')');
        }
    }
    
    function getInternalPartsIterator(minOffset, maxOffset) {
        var start = Math.max(offset, minOffset);

        var end = offset + length;
        if (maxOffset !== undefined) {
            end = Math.min(end, maxOffset);
        }
        
        if (start >= end) {
            var emptyIterator = {
                internalIteratorData: { isEndOfRange: true }
            };
            
            return emptyIterator;
        }
        
        var iterator = {
            subArray: null,
            offset: -1,
            
            internalIteratorData: {
                end: end,
                currentSubArray: null,
                currentInternalPartOffset: null,
                nextInternalPartOffset: offset,
                currentInternalPartIndex: -1,
                isEndOfRange: false
            }
        };
        
        var alreadyReachedToTheEnd = false;
        do {
            if (alreadyReachedToTheEnd) {
                throw new jGlobals.jpipExceptions.InternalErrorException('Iterator reached ' +
                    'to the end although no data has been iterated');
            }
            
            alreadyReachedToTheEnd = !tryAdvanceIterator(iterator);
        } while (start >= iterator.internalIteratorData.nextInternalPartOffset);
        
        var cutFirstSubArray =
            start - iterator.internalIteratorData.currentInternalPartOffset;
        iterator.internalIteratorData.currentSubArray =
            iterator.internalIteratorData.currentSubArray.subarray(cutFirstSubArray);
        iterator.internalIteratorData.currentInternalPartOffset = start;
        
        return iterator;
    }
    
    function tryAdvanceIterator(iterator) {
        var internalIteratorData = iterator.internalIteratorData;
        
        if (internalIteratorData.isEndOfRange) {
            return false;
        }
        
        iterator.subArray = internalIteratorData.currentSubArray;
        iterator.offset = internalIteratorData.currentInternalPartOffset;
        
        ++internalIteratorData.currentInternalPartIndex;
        
        if (internalIteratorData.nextInternalPartOffset >= internalIteratorData.end) {
            internalIteratorData.isEndOfRange = true;

            return true;
        }
        
        ensureNoEndOfArrayReached(internalIteratorData.currentInternalPartIndex);
        
        internalIteratorData.currentSubArray = internalParts[
            internalIteratorData.currentInternalPartIndex];
        internalIteratorData.currentInternalPartOffset =
            internalIteratorData.nextInternalPartOffset;
        var currentInternalPartLength =
            internalParts[internalIteratorData.currentInternalPartIndex].length;
        
        internalIteratorData.nextInternalPartOffset =
            internalIteratorData.currentInternalPartOffset + currentInternalPartLength;

        var cutLastSubArray =
            internalIteratorData.end - internalIteratorData.currentInternalPartOffset;
        var isLastSubArray =
            cutLastSubArray < internalIteratorData.currentSubArray.length;
        
        if (isLastSubArray) {
            internalIteratorData.currentSubArray = internalIteratorData
                .currentSubArray.subarray(0, cutLastSubArray);
        }
        
        return true;
    }
    
    function ensureNoEndOfArrayReached(currentInternalPartIndex) {
        if (currentInternalPartIndex >= internalParts.length) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'CompositeArray: end of part has reached. Check end calculation');
        }
    }
};
},{"j2k-jpip-globals.js":16}],8:[function(require,module,exports){
'use strict';

// A.2.1.

module.exports = function JpipDatabinParts(
    classId, inClassId, jpipFactory) {

    var self = this;

    var parts = [];
    var databinLengthIfKnown = null;
    var loadedBytes = 0;
    
    var cachedData = [];
    
    this.getDatabinLengthIfKnown = function() {
        return databinLengthIfKnown;
    };
    
    this.getLoadedBytes = function getLoadedBytes() {
        return loadedBytes;
    };
    
    this.isAllDatabinLoaded = function isAllDatabinLoaded() {
        var result;
        
        switch (parts.length) {
            case 0:
                result = databinLengthIfKnown === 0;
                break;
                
            case 1:
                result =
                    parts[0].getOffset() === 0 &&
                    parts[0].getLength() === databinLengthIfKnown;
                break;
            
            default:
                result = false;
                break;
        }
        
        return result;
    };
    
    this.getCachedData = function getCachedData(key) {
        var obj = cachedData[key];
        if (obj === undefined) {
            obj = {};
            cachedData[key] = obj;
        }
        
        return obj;
    };
    
    this.getClassId = function getClassId() {
        return classId;
    };
    
    this.getInClassId = function getInClassId() {
        return inClassId;
    };
    
    this.copyToCompositeArray = function copyToCompositeArray(result, rangeOptions) {
        var dummyResultStartOffset = 0;
        var params = getParamsForCopyBytes(dummyResultStartOffset, rangeOptions);
        
        if (params.resultWithoutCopy !== undefined) {
            return params.resultWithoutCopy;
        }
        
        var maxLengthCopied = iterateRange(
            params.databinStartOffset,
            params.maxLengthToCopy,
            function addPartToResultInCopyToCompositeArray(part, minOffsetInPart, maxOffsetInPart) {
                part.copyToOtherAtTheEnd(
                    result,
                    minOffsetInPart,
                    maxOffsetInPart);
            });
        
        return maxLengthCopied;
    };
    
    this.copyBytes = function(resultArray, resultStartOffset, rangeOptions) {
        var params = getParamsForCopyBytes(resultStartOffset, rangeOptions);
        
        if (params.resultWithoutCopy !== undefined) {
            return params.resultWithoutCopy;
        }
        
        var resultArrayOffsetInDatabin = params.databinStartOffset - params.resultStartOffset;
        
        var maxLengthCopied = iterateRange(
            params.databinStartOffset,
            params.maxLengthToCopy,
            function addPartToResultInCopyBytes(part, minOffsetInPart, maxOffsetInPart) {
                part.copyToArray(
                    resultArray,
                    resultArrayOffsetInDatabin,
                    minOffsetInPart,
                    maxOffsetInPart);
            });
        
        return maxLengthCopied;
    };
    
    this.getExistingRanges = function() {
        var result = new Array(parts.length);
        
        for (var i = 0; i < parts.length; ++i) {
            result[i] = {
                start: parts[i].getOffset(),
                length: parts[i].getLength()
                };
        }
        
        return result;
    };
    
    this.addData = function(header, message) {
        if (header.isLastByteInDatabin) {
            databinLengthIfKnown = header.messageOffsetFromDatabinStart + header.messageBodyLength;
        }
        
        if (header.messageBodyLength === 0) {
            return;
        }

        var newPart = jpipFactory.createCompositeArray(
            header.messageOffsetFromDatabinStart);

        var endOffsetInMessage = header.bodyStart + header.messageBodyLength;
        newPart.pushSubArray(message.subarray(header.bodyStart, endOffsetInMessage));

        // Find where to push the new message
        
        var indexFirstPartAfter = findFirstPartAfterOffset(header.messageOffsetFromDatabinStart);
        var indexFirstPartNearOrAfter = indexFirstPartAfter;

        if (indexFirstPartAfter > 0) {
            var previousPart = parts[indexFirstPartAfter - 1];
            var previousPartEndOffset =
                previousPart.getOffset() + previousPart.getLength();
            
            if (previousPartEndOffset === header.messageOffsetFromDatabinStart) {
                // Can merge also previous part
                --indexFirstPartNearOrAfter;
            }
        }

        if (indexFirstPartNearOrAfter >= parts.length) {
            parts.push(newPart);
            loadedBytes += header.messageBodyLength;
            
            return;
        }
        
        var firstPartNearOrAfter = parts[indexFirstPartNearOrAfter];
        var endOffsetInDatabin =
            header.messageOffsetFromDatabinStart + header.messageBodyLength;
        if (firstPartNearOrAfter.getOffset() > endOffsetInDatabin) {
            // Not found an overlapping part, push a new
            // part in the middle of the parts array
                
            for (var i = parts.length; i > indexFirstPartNearOrAfter; --i) {
                parts[i] = parts[i - 1];
            }
            
            parts[indexFirstPartNearOrAfter] = newPart;
            loadedBytes += header.messageBodyLength;

            return;
        }
        
        // Merge first and last overlapping parts - all the rest (if any) are in the middle of the new part
        
        var bytesAlreadySaved = firstPartNearOrAfter.getLength();

        var shouldSwap =
            firstPartNearOrAfter.getOffset() > header.messageOffsetFromDatabinStart;
        if (shouldSwap) {
            parts[indexFirstPartNearOrAfter] = newPart;
            newPart = firstPartNearOrAfter;
            
            firstPartNearOrAfter = parts[indexFirstPartNearOrAfter];
        }

        newPart.copyToOther(firstPartNearOrAfter);
        
        var endOffset =
            firstPartNearOrAfter.getOffset() + firstPartNearOrAfter.getLength();
        
        var partToMergeIndex;
        for (partToMergeIndex = indexFirstPartNearOrAfter;
            partToMergeIndex < parts.length - 1;
            ++partToMergeIndex) {
            
            if (endOffset < parts[partToMergeIndex + 1].getOffset()) {
                break;
            }
            
            bytesAlreadySaved += parts[partToMergeIndex + 1].getLength();
        }
        
        var partsToDelete = partToMergeIndex - indexFirstPartNearOrAfter;
        if (partsToDelete > 0) {
            parts[partToMergeIndex].copyToOther(firstPartNearOrAfter);
            
            // Delete all middle and merged parts except 1
            
            for (var j = indexFirstPartNearOrAfter + 1; j < parts.length - partsToDelete; ++j) {
                parts[j] = parts[j + partsToDelete];
            }
            
            parts.length -= partsToDelete;
        }
        
        loadedBytes += firstPartNearOrAfter.getLength() - bytesAlreadySaved;
    };
    
    function getParamsForCopyBytes(resultStartOffset, rangeOptions) {
        var forceCopyAllRange = false;
        var databinStartOffset = 0;
        var maxLengthToCopy;
        
        if (rangeOptions !== undefined) {
            forceCopyAllRange = !!rangeOptions.forceCopyAllRange;
            databinStartOffset = rangeOptions.databinStartOffset;
            maxLengthToCopy = rangeOptions.maxLengthToCopy;
            
            if (databinStartOffset === undefined) {
                databinStartOffset = 0;
            }
        }
        
        if (resultStartOffset === undefined) {
            resultStartOffset = 0;
        }
        
        if (maxLengthToCopy === 0) {
            return { resultWithoutCopy: 0 };
        }
        
        if ((databinLengthIfKnown !== null) && (databinStartOffset >= databinLengthIfKnown)) {
            return { resultWithoutCopy: (!!maxLengthToCopy && forceCopyAllRange ? null : 0) };
        }
        
        var firstRelevantPartIndex = findFirstPartAfterOffset(databinStartOffset);
        
        if (firstRelevantPartIndex === parts.length) {
            return { resultWithoutCopy: (forceCopyAllRange ? null : 0) };
        }
        
        if (forceCopyAllRange) {
            var isAllRequestedRangeExist =
                isAllRangeExist(databinStartOffset, maxLengthToCopy, firstRelevantPartIndex);
            
            if (!isAllRequestedRangeExist) {
                return { resultWithoutCopy: null };
            }
        }
        
        var params = {
            databinStartOffset: databinStartOffset,
            maxLengthToCopy: maxLengthToCopy,
            resultStartOffset: resultStartOffset
            };
        
        return params;
    }
    
    function isAllRangeExist(
        databinStartOffset, maxLengthToCopy, firstRelevantPartIndex) {
        
        if (parts[firstRelevantPartIndex].getOffset() > databinStartOffset) {
            return false;
        }
        
        if (maxLengthToCopy) {
            var unusedElements =
                databinStartOffset - parts[firstRelevantPartIndex].getOffset();
            var availableLength =
                parts[firstRelevantPartIndex].getLength() - unusedElements;
            
            var isUntilMaxLengthExist = availableLength >= maxLengthToCopy;
            return isUntilMaxLengthExist;
        }
        
        if (databinLengthIfKnown === null ||
            firstRelevantPartIndex < parts.length - 1) {
            
            return false;
        }
        
        var lastPart = parts[parts.length - 1];
        var endOffsetRecieved = lastPart.getOffset() + lastPart.getLength();
        
        var isUntilEndOfDatabinExist = endOffsetRecieved === databinLengthIfKnown;
        return isUntilEndOfDatabinExist;
    }
    
    function iterateRange(
            databinStartOffset,
            maxLengthToCopy,
        addSubPartToResult) {
        
        var minOffsetInDatabinToCopy = databinStartOffset;
        
        var maxOffsetInDatabinToCopy;
        if (maxLengthToCopy !== undefined) {
            maxOffsetInDatabinToCopy = databinStartOffset + maxLengthToCopy;
        } else {
            var lastPart = parts[parts.length - 1];
            maxOffsetInDatabinToCopy = lastPart.getOffset() + lastPart.getLength();
        }
                
        var lastCopiedPart = null;
        
        for (var i = 0; i < parts.length; ++i) {
            if (parts[i].getOffset() >= maxOffsetInDatabinToCopy) {
                break;
            }
            
            var currentMinOffsetInDatabinToCopy = Math.max(
                minOffsetInDatabinToCopy, parts[i].getOffset());
            var currentMaxOffsetInDatabinToCopy = Math.min(
                maxOffsetInDatabinToCopy, parts[i].getOffset() + parts[i].getLength());
        
            addSubPartToResult(
                parts[i],
                currentMinOffsetInDatabinToCopy,
                currentMaxOffsetInDatabinToCopy);
            
            lastCopiedPart = parts[i];
        }
        
        if (lastCopiedPart === null) {
            return 0;
        }
        
        var lastOffsetCopied = Math.min(
            lastCopiedPart.getOffset() + lastCopiedPart.getLength(),
            maxOffsetInDatabinToCopy);
        
        var maxLengthCopied = lastOffsetCopied - databinStartOffset;
        return maxLengthCopied;
    }

    function findFirstPartAfterOffset(offset) {
        var index;
        for (index = 0; index < parts.length; ++index) {
            if (parts[index].getOffset() + parts[index].getLength() > offset) {
                break;
            }
        }
        
        return index;
    }
    
    return this;
};
},{}],9:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipDatabinsSaver(isJpipTilePartStream, jpipFactory) {
    var PRECINCT_NO_AUX_CLASS = 0;
    var PRECINCT_WITH_AUX_CLASS = 1;
    var TILE_HEADER_CLASS = 2;
    var TILE_NO_AUX_CLASS = 4;
    var TILE_WITH_AUX_CLASS = 5;

    var databinsByClass = [];
    var forbiddenInJpp = [];
    var forbiddenInJpt = [];
    
    var loadedBytes = 0;
    var loadedBytesInRegisteredDatabins = 0;

    // Valid only if isJpipTilePartStream = false
    
    databinsByClass[TILE_HEADER_CLASS] = createDatabinsArray();
    databinsByClass[PRECINCT_NO_AUX_CLASS] = createDatabinsArray();
    databinsByClass[PRECINCT_WITH_AUX_CLASS] = databinsByClass[
        PRECINCT_NO_AUX_CLASS];
    
    forbiddenInJpt[TILE_HEADER_CLASS] = true;
    forbiddenInJpt[PRECINCT_NO_AUX_CLASS] = true;
    forbiddenInJpt[PRECINCT_WITH_AUX_CLASS] = true;
    
    // Valid only if isJpipTilePartStream = true

    databinsByClass[TILE_NO_AUX_CLASS] = createDatabinsArray();
    databinsByClass[TILE_WITH_AUX_CLASS] = databinsByClass[
        TILE_NO_AUX_CLASS];
    
    forbiddenInJpp[TILE_NO_AUX_CLASS] = true;
    forbiddenInJpp[TILE_WITH_AUX_CLASS] = true;
    
    var mainHeaderDatabin = jpipFactory.createDatabinParts(6, 0);
    
    this.getIsJpipTilePartStream = function() {
        return isJpipTilePartStream;
    };
    
    this.getLoadedBytes = function getLoadedBytes() {
        return loadedBytes;
    };

    this.getMainHeaderDatabin = function () {
        return mainHeaderDatabin;
    };
    
    this.getTileHeaderDatabin = function(inClassIndex) {
        var databin = getDatabinFromArray(
            databinsByClass[TILE_HEADER_CLASS],
            TILE_HEADER_CLASS,
            inClassIndex,
            /*isJpipTilePartStreamExpected=*/false,
            'tileHeader');
        
        return databin;
    };
    
    this.getPrecinctDatabin = function(inClassIndex) {
        var databin = getDatabinFromArray(
            databinsByClass[PRECINCT_NO_AUX_CLASS],
            PRECINCT_NO_AUX_CLASS,
            inClassIndex,
            /*isJpipTilePartStreamExpected=*/false,
            'precinct');
        
        return databin;
    };
    
    this.getTileDatabin = function(inClassIndex) {
        var databin = getDatabinFromArray(
            databinsByClass[TILE_NO_AUX_CLASS],
            TILE_NO_AUX_CLASS,
            inClassIndex,
            /*isJpipTilePartStreamExpected=*/true,
            'tilePart');
        
        return databin;
    };
    
    this.addEventListener = function addEventListener(
        databin, event, listener, listenerThis) {
        
        if (event !== 'dataArrived') {
            throw new jGlobals.jpipExceptions.InternalErrorException('Unsupported event: ' +
                event);
        }
        
        var classId = databin.getClassId();
        var inClassId = databin.getInClassId();
        var databinsArray = databinsByClass[classId];
        
        if (databin !== databinsArray.databins[inClassId]) {
            throw new jGlobals.jpipExceptions.InternalErrorException('Unmatched databin ' +
                'with class-ID=' + classId + ' and in-class-ID=' + inClassId);
        }
        
        if (databinsArray.listeners[inClassId] === undefined) {
            databinsArray.listeners[inClassId] = [];
        }
        
        if (databinsArray.listeners[inClassId].length === 0) {
            loadedBytesInRegisteredDatabins += databin.getLoadedBytes();
        }
        
        databinsArray.listeners[inClassId].push({
            listener: listener,
            listenerThis: listenerThis,
            isRegistered: true
            });
        
        databinsArray.databinsWithListeners[inClassId] = databin;
    };
    
    this.removeEventListener = function removeEventListener(
        databin, event, listener) {
        
        if (event !== 'dataArrived') {
            throw new jGlobals.jpipExceptions.InternalErrorException('Unsupported event: ' +
                event);
        }

        var classId = databin.getClassId();
        var inClassId = databin.getInClassId();
        var databinsArray = databinsByClass[classId];
        var listeners = databinsArray.listeners[inClassId];
        
        if (databin !== databinsArray.databins[inClassId] ||
            databin !== databinsArray.databinsWithListeners[inClassId]) {
            
            throw new jGlobals.jpipExceptions.InternalErrorException('Unmatched databin ' +
                'with class-ID=' + classId + ' and in-class-ID=' + inClassId);
        }
        
        for (var i = 0; i < listeners.length; ++i) {
            if (listeners[i].listener === listener) {
                listeners[i].isRegistered = true;
                listeners[i] = listeners[listeners.length - 1];
                listeners.length -= 1;
                
                if (listeners.length === 0) {
                    delete databinsArray.databinsWithListeners[inClassId];
                    loadedBytesInRegisteredDatabins -= databin.getLoadedBytes();
                }
                
                return;
            }
        }
        
        throw new jGlobals.jpipExceptions.InternalErrorException(
            'Could not unregister listener from databin');
    };
    
    this.cleanupUnregisteredDatabins = function cleanupUnregisteredDatabins() {
        for (var i = 0; i < databinsByClass.length; ++i) {
            if (databinsByClass[i] === undefined) {
                continue;
            }
            
            var databins = databinsByClass[i].databinsWithListeners;
            databinsByClass[i].databins = databins.slice();
        }
        
        loadedBytes = loadedBytesInRegisteredDatabins;
    };

    this.saveData = function (header, message) {
        // A.2.2
        
        if (header.codestreamIndex !== 0) {
            throw new jGlobals.jpipExceptions.UnsupportedFeatureException(
                'Non zero Csn (Code Stream Index)', 'A.2.2');
        }
        
        switch (header.classId) {
            case 6:
                saveMainHeader(header, message);
                break;
                
            case 8:
                saveMetadata(header, message);
                break;
            
            default:
                // A.3.2, A.3.3, A.3.4
                
                var databinsArray = databinsByClass[header.classId];
                if (databinsArray === undefined) {
                    break; // A.2.2
                }
                
                var isJptExpected = !!forbiddenInJpp[header.classId];
                var databin = getDatabinFromArray(
                    databinsArray,
                    header.classId,
                    header.inClassId,
                    isJptExpected,
                    '<class ID ' + header.classId + '>');
                
                var bytesBefore = databin.getLoadedBytes();
                databin.addData(header, message);
                var bytesDifference = databin.getLoadedBytes() - bytesBefore;
                loadedBytes += bytesDifference;
                
                var listeners = databinsArray.listeners;
                var databinListeners = listeners[header.inClassId];
                
                if (databinListeners !== undefined && databinListeners.length > 0) {
                    loadedBytesInRegisteredDatabins += bytesDifference;
                    
                    var localListeners = databinListeners.slice();
                    
                    for (var i = 0; i < localListeners.length; ++i) {
                        var listener = localListeners[i];
                        if (listener.isRegistered) {
                            listener.listener.call(listener.listenerThis, databin);
                        }
                    }
                }
                
                break;
        }
    };
    
    function saveMainHeader(header, message) {
        // A.3.5
        
        if (header.inClassId !== 0) {
            throw new jGlobals.jpipExceptions.IllegalDataException('Main header data-bin with ' +
                'in-class index other than zero is not valid', 'A.3.5');
        }
        
        var bytesBefore = mainHeaderDatabin.getLoadedBytes();
        mainHeaderDatabin.addData(header, message);
        var bytesDifference = mainHeaderDatabin.getLoadedBytes() - bytesBefore;
        
        loadedBytes += bytesDifference;
        loadedBytesInRegisteredDatabins += bytesDifference;
    }
    
    function saveMetadata(header, message) {
        // A.3.6
        
        // throw new jGlobals.jpipExceptions.UnsupportedFeatureException('recieve metadata-bin', 'A.3.6');
        
        // ignore unused metadata (legal according to A.2.2).
    }
    
    function getDatabinFromArray(
        databinsArray,
        classId,
        inClassId,
        isJpipTilePartStreamExpected,
        databinTypeDescription) {
        
        if (isJpipTilePartStreamExpected !== isJpipTilePartStream) {
            throw new jGlobals.jpipExceptions.WrongStreamException('databin of type ' +
                databinTypeDescription, isJpipTilePartStream);
        }
        
        var databin = databinsArray.databins[inClassId];
        if (!databin) {
            databin = jpipFactory.createDatabinParts(classId, inClassId);
            databinsArray.databins[inClassId] = databin;
        }
        
        return databin;
    }
    
    function createDatabinsArray() {
        return {
            databins: [],
            listeners: [],
            databinsWithListeners: []
            };
    }
    
    return this;
};
},{"j2k-jpip-globals.js":16}],10:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipObjectPoolByDatabin() {
    var databinIdToObject = [];
    
    this.getObject = function getObject(databin) {
        var classId = databin.getClassId();
        var inClassIdToObject = databinIdToObject[classId];
        
        if (inClassIdToObject === undefined) {
            inClassIdToObject = [];
            databinIdToObject[classId] = inClassIdToObject;
        }
        
        var inClassId = databin.getInClassId();
        var obj = inClassIdToObject[inClassId];
        
        if (obj === undefined) {
            obj = {};
            obj.databin = databin;
            
            inClassIdToObject[inClassId] = obj;
        } else if (obj.databin !== databin) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Databin IDs are not unique');
        }
        
        return obj;
    };
};
},{"j2k-jpip-globals.js":16}],11:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipRequestDatabinsListener(
    codestreamPartParams,
    qualityLayerReachedCallback,
    codestreamStructure,
    databinsSaver,
    qualityLayersCache,
    jpipFactory) {
    
    var numQualityLayersToWaitFor;
    var tileHeadersNotLoaded = 0;
    var minNumQualityLayersReached = 0;
    var unregistered = false;
    
    var registeredTileHeaderDatabins = [];
    var registeredPrecinctDatabins = [];
    var accumulatedDataPerDatabin = jpipFactory.createObjectPoolByDatabin();
    var precinctCountByReachedQualityLayer = [];
    
    register();
    
    this.unregister = function unregister() {
        if (unregistered) {
            return;
        }
    
        for (var i = 0; i < registeredTileHeaderDatabins.length; ++i) {
            databinsSaver.removeEventListener(
                registeredTileHeaderDatabins[i],
                'dataArrived',
                tileHeaderDataArrived);
        }
        
        for (var j = 0; j < registeredPrecinctDatabins.length; ++j) {
            databinsSaver.removeEventListener(
                registeredPrecinctDatabins[j],
                'dataArrived',
                precinctDataArrived);
        }
        
        unregistered = true;
    };
    
    function register() {
        ++tileHeadersNotLoaded;
        
        var tileIterator = codestreamStructure.getTilesIterator(codestreamPartParams);
        do {
            var tileIndex = tileIterator.tileIndex;
            var databin = databinsSaver.getTileHeaderDatabin(tileIndex);
            registeredTileHeaderDatabins.push(databin);
            
            databinsSaver.addEventListener(
                databin, 'dataArrived', tileHeaderDataArrived);
                
            ++tileHeadersNotLoaded;
            tileHeaderDataArrived(databin);
        } while (tileIterator.tryAdvance());
        
        --tileHeadersNotLoaded;
        tryAdvanceQualityLayersReached();
    }
    
    function tileHeaderDataArrived(tileHeaderDatabin) {
        if (!tileHeaderDatabin.isAllDatabinLoaded()) {
            return;
        }
        
        var tileAccumulatedData = accumulatedDataPerDatabin.getObject(
            tileHeaderDatabin);
        
        if (tileAccumulatedData.isAlreadyLoaded) {
            return;
        }
        
        tileAccumulatedData.isAlreadyLoaded = true;
        --tileHeadersNotLoaded;
        
        var tileIndex = tileHeaderDatabin.getInClassId();
        var tileStructure = codestreamStructure.getTileStructure(tileIndex);
        var qualityInTile = tileStructure.getNumQualityLayers();
        
        var precinctIterator = tileStructure.getPrecinctIterator(
            tileIndex, codestreamPartParams);

        do {
            if (!precinctIterator.isInCodestreamPart) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Unexpected precinct not in codestream part');
            }
            
            var inClassId = tileStructure.precinctPositionToInClassIndex(
                precinctIterator);
                
            var precinctDatabin = databinsSaver.getPrecinctDatabin(inClassId);
            registeredPrecinctDatabins.push(precinctDatabin);
            var accumulatedData = accumulatedDataPerDatabin.getObject(
                precinctDatabin);
            
            if (accumulatedData.qualityInTile !== undefined) {
                throw new jGlobals.jpipExceptions.InternalErrorException('Tile was ' +
                    'iterated twice in codestream part');
            }
            
            accumulatedData.qualityInTile = qualityInTile;
            incrementPrecinctQualityLayers(
                precinctDatabin, accumulatedData, precinctIterator);
            
            databinsSaver.addEventListener(
                precinctDatabin, 'dataArrived', precinctDataArrived);
        } while (precinctIterator.tryAdvance());
        
        tryAdvanceQualityLayersReached();
    }
    
    function precinctDataArrived(precinctDatabin) {
        var local = unregistered;
        var accumulatedData = accumulatedDataPerDatabin.getObject(
            precinctDatabin);

        var oldQualityLayersReached = accumulatedData.numQualityLayersReached;
        var qualityInTile =
            accumulatedData.qualityInTile;

        if (oldQualityLayersReached === qualityInTile) {
            return;
        }
        
        --precinctCountByReachedQualityLayer[oldQualityLayersReached];
        incrementPrecinctQualityLayers(precinctDatabin, accumulatedData);
        
        tryAdvanceQualityLayersReached();
    }
    
    function incrementPrecinctQualityLayers(
        precinctDatabin, accumulatedData, precinctIteratorOptional) {
        
        var qualityLayers = qualityLayersCache.getQualityLayerOffset(
            precinctDatabin,
            codestreamPartParams.quality,
            precinctIteratorOptional);

        var numQualityLayersReached = qualityLayers.numQualityLayers;
        accumulatedData.numQualityLayersReached = numQualityLayersReached;

        var qualityInTile =
            accumulatedData.qualityInTile;

        if (numQualityLayersReached === qualityInTile) {
            return;
        }
        
        var prevCount =
            precinctCountByReachedQualityLayer[numQualityLayersReached] || 0;
        
        precinctCountByReachedQualityLayer[numQualityLayersReached] =
            prevCount + 1;
    }
    
    function tryAdvanceQualityLayersReached() {
        if (precinctCountByReachedQualityLayer[minNumQualityLayersReached] > 0 ||
            minNumQualityLayersReached === 'max' ||
            minNumQualityLayersReached >= numQualityLayersToWaitFor ||
            tileHeadersNotLoaded > 0) {
            
            return;
        }
        
        var hasPrecinctsInQualityLayer;
        var maxQualityLayers = precinctCountByReachedQualityLayer.length;
        
        do {
            ++minNumQualityLayersReached;
            
            if (minNumQualityLayersReached >= maxQualityLayers) {
                minNumQualityLayersReached = 'max';
                break;
            }
            
            hasPrecinctsInQualityLayer =
                precinctCountByReachedQualityLayer[minNumQualityLayersReached] > 0;
        } while (!hasPrecinctsInQualityLayer);
        
        qualityLayerReachedCallback(minNumQualityLayersReached);
    }
    
    function ensureQualityLayersStatisticsForDebug() {
        var precinctCountByReachedQualityLayerExpected = [];
        
        for (var i = 0; i < registeredPrecinctDatabins.length; ++i) {
            var accumulatedData = accumulatedDataPerDatabin.getObject(
                registeredPrecinctDatabins[i]);
            
            var qualityInTile =
                accumulatedData.qualityInTile;
                
            if (qualityInTile === undefined) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'No information of qualityInTile in ' +
                    'JpipRequestDatabinsListener');
            }
            
            var qualityLayers = qualityLayersCache.getQualityLayerOffset(
                registeredPrecinctDatabins[i],
                codestreamPartParams.quality);
            
            if (qualityLayers.numQualityLayers === qualityInTile) {
                continue;
            }
            
            var oldValue = precinctCountByReachedQualityLayerExpected[
                qualityLayers.numQualityLayers];
            
            precinctCountByReachedQualityLayerExpected[
                qualityLayers.numQualityLayers] = (oldValue || 0) + 1;
        }
        
        var length = Math.max(
            precinctCountByReachedQualityLayerExpected.length,
            precinctCountByReachedQualityLayer.length);
            
        var minNumQualityLayersReachedExpected = 'max';
        
        for (var j = 0; j < length; ++j) {
            var isExpectedZero = (precinctCountByReachedQualityLayerExpected[j] || 0) === 0;
            var isActualZero = (precinctCountByReachedQualityLayer[j] || 0) === 0;
            
            if (isExpectedZero !== isActualZero) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Wrong accumulated statistics in JpipRequestDatabinsListener');
            }
            
            if (isExpectedZero) {
                continue;
            }
            
            if (precinctCountByReachedQualityLayer[j] !==
                precinctCountByReachedQualityLayerExpected[j]) {
                
                throw new jGlobals.jpipExceptions.InternalErrorException('Wrong ' +
                    'accumulated statistics in JpipRequestDatabinsListener');
            }
            
            if (minNumQualityLayersReachedExpected === 'max') {
                minNumQualityLayersReachedExpected = j;
            }
        }
        
        if (minNumQualityLayersReached !== minNumQualityLayersReachedExpected) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Wrong minNumQualityLayersReached in JpipRequestDatabinsListener');
        }
    }
};
},{"j2k-jpip-globals.js":16}],12:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipCodestreamStructure(
    jpipStructureParser,
    jpipFactory,
    progressionOrder) {

    var self = this;
    var params;
    var sizesCalculator;
    
    var defaultTileStructureByEdgeType;

    var cachedTileStructures = [];
    
    this.getSizesParams = function getSizesParams() {
        validateParams();
        return params;
    };
    
    this.getNumTilesX = function getNumTilesX() {
        validateParams();
        
        var numTiles = sizesCalculator.getNumTilesX();
        return numTiles;
    };
    
    this.getNumTilesY = function getNumTilesY() {
        validateParams();
        
        var numTiles = sizesCalculator.getNumTilesY();
        return numTiles;
    };

    this.getNumComponents = function() {
        validateParams();
        return params.numComponents;
    };
    
    this.getImageWidth = function() {
        validateParams();

        var size = sizesCalculator.getLevelWidth();
        return size;
    };
    
    this.getImageHeight = function() {
        validateParams();

        var size = sizesCalculator.getLevelHeight();
        return size;
    };
    
    this.getLevelWidth = function(level) {
        validateParams();

        var size = sizesCalculator.getLevelWidth(level);
        return size;
    };
    
    this.getLevelHeight = function(level) {
        validateParams();

        var size = sizesCalculator.getLevelHeight(level);
        return size;
    };
    
    this.getTileWidth = function(level) {
        validateParams();

        var size = sizesCalculator.getTileWidth(level);
        return size;
    };
    
    this.getTileHeight = function(level) {
        validateParams();

        var size = sizesCalculator.getTileHeight(level);
        return size;
    };
    
    this.getFirstTileOffsetX = function() {
        validateParams();

        var offset = sizesCalculator.getFirstTileOffsetX();
        return offset;
    };
    
    this.getFirstTileOffsetY = function() {
        validateParams();

        var offset = sizesCalculator.getFirstTileOffsetY();
        return offset;
    };
    
    this.getTileLeft = function getTileLeft(
        tileIndex, level) {
        
        validateParams();
        
        var tileX = tileIndex % sizesCalculator.getNumTilesX();
        if (tileX === 0) {
            return 0;
        }
        
        var tileLeft =
            (tileX - 1) * sizesCalculator.getTileWidth(level) +
            sizesCalculator.getFirstTileWidth(level);
        
        return tileLeft;
    };
    
    this.getTileTop = function getTileTop(tileIndex, level) {
        validateParams();
        
        var tileY = Math.floor(tileIndex / sizesCalculator.getNumTilesX());
        if (tileY === 0) {
            return 0;
        }
        
        var tileTop =
            (tileY - 1) * sizesCalculator.getTileHeight(level) +
            sizesCalculator.getFirstTileHeight(level);
        
        return tileTop;
    };
    
    this.getDefaultTileStructure = function getDefaultTileStructure() {
        validateParams();
        var result = getDefaultTileStructureInternal({
            horizontalEdgeType: sizesCalculator.EDGE_TYPE_NO_EDGE,
            verticalEdgeType: sizesCalculator.EDGE_TYPE_NO_EDGE
            });
            
        return result;
    };
    
    this.getTileStructure = getTileStructure;

    this.tilePositionToInClassIndex = function(tilePosition) {
        validateParams();
        var tilesX = sizesCalculator.getNumTilesX();
        var tilesY = sizesCalculator.getNumTilesY();
        
        validateArgumentInRange('tilePosition.tileX', tilePosition.tileX, tilesX);
        validateArgumentInRange('tilePosition.tileY', tilePosition.tileY, tilesY);

        var inClassIndex = tilePosition.tileX + tilePosition.tileY * tilesX;
        
        return inClassIndex;
    };

    this.tileInClassIndexToPosition = function(inClassIndex) {
        validateParams();
        var tilesX = sizesCalculator.getNumTilesX();
        var tilesY = sizesCalculator.getNumTilesY();
        var numTiles = tilesX * tilesY;

        validateArgumentInRange('inClassIndex', inClassIndex, tilesX * tilesY);
        
        var tileX = inClassIndex % tilesX;
        var tileY = (inClassIndex - tileX) / tilesX;
        
        var result = {
            tileX: tileX,
            tileY: tileY
            };
        
        return result;
    };
    
    this.getTilesIterator = function getTilesIterator(codestreamPartParams) {
        validateParams();
        var bounds = sizesCalculator.getTilesFromPixels(codestreamPartParams);
        
        var setableIterator = {
            currentX: bounds.minTileX,
            currentY: bounds.minTileY
        };
        
        var iterator = {
            get tileIndex() {
                var firstInRow =
                    setableIterator.currentY * sizesCalculator.getNumTilesX();
                var index = firstInRow + setableIterator.currentX;
                
                return index;
            },
            
            tryAdvance: function tryAdvance() {
                var result = tryAdvanceTileIterator(setableIterator, bounds);
                return result;
            }
        };
        
        return iterator;
    };
    
    this.getSizeOfPart = function getSizeOfPart(codestreamPartParams) {
        validateParams();
        
        var size = sizesCalculator.getSizeOfPart(codestreamPartParams);
        return size;
    };
    
    function tryAdvanceTileIterator(setableIterator, bounds) {
        if (setableIterator.currentY >= bounds.maxTileYExclusive) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Cannot advance tile iterator after end');
        }
        
        ++setableIterator.currentX;
        if (setableIterator.currentX < bounds.maxTileXExclusive) {
            return true;
        }
        
        setableIterator.currentX = bounds.minTileX;
        ++setableIterator.currentY;
        
        var isMoreTilesAvailable =
            setableIterator.currentY < bounds.maxTileYExclusive;
        
        return isMoreTilesAvailable;
    }
    
    function getTileStructure(tileId) {
        validateParams();
        
        var maxTileId =
            sizesCalculator.getNumTilesX() * sizesCalculator.getNumTilesY()- 1;
        
        if (tileId < 0 || tileId > maxTileId) {
            throw new jGlobals.jpipExceptions.ArgumentException(
                'tileId',
                tileId,
                'Expected value between 0 and ' + maxTileId);
        }
        
        var isEdge = sizesCalculator.isEdgeTileId(tileId);
        
        if (cachedTileStructures[tileId] === undefined) {
            var tileParams = jpipStructureParser.parseOverridenTileParams(tileId);
            
            if (!!tileParams) {
                cachedTileStructures[tileId] = createTileStructure(tileParams, isEdge);
            }
            else {
                cachedTileStructures[tileId] = null;
            }
        }
        
        if (cachedTileStructures[tileId]) {
            return cachedTileStructures[tileId];
        }
        
        var result = getDefaultTileStructureInternal(isEdge);
        return result;
    }

    function validateArgumentInRange(paramName, paramValue, suprimumParamValue) {
        if (paramValue < 0 || paramValue >= suprimumParamValue) {
            throw new jGlobals.jpipExceptions.ArgumentException(
                paramName,
                paramValue,
                paramName + ' is expected to be between 0 and ' + suprimumParamValue - 1);
        }
    }
    
    function getDefaultTileStructureInternal(edgeType) {
        if (!defaultTileStructureByEdgeType) {
            var defaultTileParams = jpipStructureParser.parseDefaultTileParams();
            
            defaultTileStructureByEdgeType = new Array(3);
            
            for (var horizontalEdge = 0; horizontalEdge < 3; ++horizontalEdge) {
                defaultTileStructureByEdgeType[horizontalEdge] = new Array(3);
                
                for (var verticalEdge = 0; verticalEdge < 3; ++verticalEdge) {
                    var edge = {
                        horizontalEdgeType: horizontalEdge,
                        verticalEdgeType: verticalEdge
                        };
                    
                    defaultTileStructureByEdgeType[horizontalEdge][verticalEdge] =
                        createTileStructure(defaultTileParams, edge);
                }
            }
        }
        
        var structureByVerticalType =
            defaultTileStructureByEdgeType[edgeType.horizontalEdgeType];
        
        var tileStructure = structureByVerticalType[edgeType.verticalEdgeType];
        
        return tileStructure;
    }
    
    function createTileStructure(tileParams, edgeType) {
        validateParams();
        
        var sizeParams = JSON.parse(JSON.stringify(tileParams));
        
        sizeParams.tileSize = sizesCalculator.getTileSize(edgeType);
        
        sizeParams.defaultComponentParams.scaleX = 1;
        sizeParams.defaultComponentParams.scaleY = 1;
        
        for (var i = 0; i < sizeParams.paramsPerComponent.length; ++i) {
            sizeParams.paramsPerComponent[i].scaleX = params.componentsScaleX[i];
            sizeParams.paramsPerComponent[i].scaleY = params.componentsScaleY[i];
        }
        
        var tileStructure = jpipFactory.createTileStructure(sizeParams, self, progressionOrder);
        
        return tileStructure;
    }
    
    function validateParams(self) {
        if (!params) {
            params = jpipStructureParser.parseCodestreamStructure();
            sizesCalculator = jpipFactory.createLevelCalculator(params);
        }
    }
    
    return this;
};
},{"j2k-jpip-globals.js":16}],13:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipComponentStructure(
    params, tileStructure) {
    
    var tileWidthLevel0;
    var tileHeightLevel0;
    
    initialize();
    
    this.getComponentScaleX = function getComponentScaleX() {
        return params.scaleX;
    };
    
    this.getComponentScaleY = function getComponentScaleY() {
        return params.scaleY;
    };
    
    this.getNumResolutionLevels = function() {
        return params.numResolutionLevels;
    };
    
    this.getPrecinctWidth = function(resolutionLevel) {
        var width = params.precinctWidthPerLevel[resolutionLevel];
        
        return width;
    };
    
    this.getPrecinctHeight = function(resolutionLevel) {
        var height = params.precinctHeightPerLevel[resolutionLevel];
        
        return height;
    };
    
    this.getMaxCodeblockWidth = function getMaxCodeblockWidth() {
        var width = params.maxCodeblockWidth;
        
        return width;
    };
    
    this.getMaxCodeblockHeight = function getMaxCodeblockHeight() {
        var height = params.maxCodeblockHeight;
        
        return height;
    };
    
    this.getNumCodeblocksXInPrecinct =
        function getNumCodeblocksX(precinct) {
        
        var numCodeblocksX = calculateNumCodeblocks(
            precinct,
            precinct.precinctX,
            params.maxCodeblockWidth,
            params.precinctWidthPerLevel,
            tileWidthLevel0);
        
        return numCodeblocksX;
    };
    
    this.getNumCodeblocksYInPrecinct =
        function getNumCodeblocksY(precinct) {
        
        var numCodeblocksY = calculateNumCodeblocks(
            precinct,
            precinct.precinctY,
            params.maxCodeblockHeight,
            params.precinctHeightPerLevel,
            tileHeightLevel0);
        
        return numCodeblocksY;
    };

    this.getNumPrecinctsX = function(resolutionLevel) {
        var precinctsX = calculateNumPrecincts(
            tileWidthLevel0, params.precinctWidthPerLevel, resolutionLevel);
            
        return precinctsX;
    };
    
    this.getNumPrecinctsY = function(resolutionLevel) {
        var precinctsY = calculateNumPrecincts(
            tileHeightLevel0, params.precinctHeightPerLevel, resolutionLevel);
            
        return precinctsY;
    };
    
    function calculateNumPrecincts(
        tileSizeLevel0, precinctSizePerLevel, resolutionLevel) {
    
        var resolutionFactor = getResolutionFactor(resolutionLevel);
        var tileSizeInLevel = tileSizeLevel0 / resolutionFactor;
        
        var precinctSizeInLevel = precinctSizePerLevel[resolutionLevel];
        
        var numPrecincts = Math.ceil(tileSizeInLevel / precinctSizeInLevel);
        return numPrecincts;
    }
    
    function calculateNumCodeblocks(
        precinct,
        precinctIndex,
        maxCodeblockSize,
        precinctSizePerLevel,
        tileSizeLevel0) {
        
        var resolutionFactor = getResolutionFactor(precinct.resolutionLevel);
        var tileSizeInLevel = Math.ceil(tileSizeLevel0 / resolutionFactor);
        
        var precinctBeginPixel =
            precinctIndex * precinctSizePerLevel[precinct.resolutionLevel];
        
        var precinctSize = Math.min(
            precinctSizePerLevel[precinct.resolutionLevel],
            tileSizeInLevel - precinctBeginPixel);
        
        var subbandTypeFactor = precinct.resolutionLevel === 0 ? 1 : 2;
        var subbandOfPrecinctSize = Math.ceil(precinctSize / subbandTypeFactor);
        
        var numCodeblocks = subbandTypeFactor * Math.ceil(
            subbandOfPrecinctSize / maxCodeblockSize);
        
        if (precinctSize % maxCodeblockSize === 1 &&
            precinct.resolutionLevel > 0) {
            
            --numCodeblocks;
        }
        
        return numCodeblocks;
    }
    
    function getResolutionFactor(resolutionLevel) {
        var differenceFromBestLevel = params.numResolutionLevels - resolutionLevel - 1;
        
        var factor = 1 << differenceFromBestLevel;
        
        return factor;
    }
    
    function initialize() {
        if (params.scaleX !== 1 || params.scaleY !== 1) {
            throw new jGlobals.j2kExceptions.UnsupportedFeatureException(
                'Non 1 component scale', 'A.5.1');
        }
        
        tileWidthLevel0 = Math.floor(
            tileStructure.getTileWidth() / params.scaleX);
        tileHeightLevel0 = Math.floor(
            tileStructure.getTileHeight() / params.scaleY);
    }
};
},{"j2k-jpip-globals.js":16}],14:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = JpipRequestParamsModifier;

function JpipRequestParamsModifier(codestreamStructure) {
    this.modify = function modify(codestreamPartParams, options) {
        var codestreamPartParamsModified = castCodestreamPartParams(codestreamPartParams);

        options = options || {};
        var useCachedDataOnly = options.useCachedDataOnly;
        var disableProgressiveness = options.disableProgressiveness;

        var progressivenessModified;
        if (options.progressiveness !== undefined) {
            if (useCachedDataOnly || disableProgressiveness) {
                throw new jGlobals.jpipExceptions.ArgumentException(
                    'options.progressiveness',
                    options.progressiveness,
                    'options contradiction: cannot accept both progressiveness' +
                    'and useCachedDataOnly/disableProgressiveness options');
            }
            progressivenessModified = castProgressivenessParams(
                options.progressiveness,
                codestreamPartParamsModified.quality,
                'quality');
        } else  if (useCachedDataOnly) {
            progressivenessModified = [ { minNumQualityLayers: 0 } ];
        } else if (disableProgressiveness) {
            var quality = codestreamPartParamsModified.quality;
            var minNumQualityLayers =
                quality === undefined ? 'max' : quality;
            
            progressivenessModified = [ { minNumQualityLayers: minNumQualityLayers } ];
        } else {
            progressivenessModified = getAutomaticProgressivenessStages(
                codestreamPartParamsModified.quality);
        }
        
        return {
            codestreamPartParams: codestreamPartParamsModified,
            progressiveness: progressivenessModified
        };
    };

    function castProgressivenessParams(progressiveness, quality, propertyName) {
        // Ensure than minNumQualityLayers is given for all items
        
        var result = new Array(progressiveness.length);

        for (var i = 0; i < progressiveness.length; ++i) {
            var minNumQualityLayers = progressiveness[i].minNumQualityLayers;
            
            if (minNumQualityLayers !== 'max') {
                if (quality !== undefined &&
                    minNumQualityLayers > quality) {
                    
                    throw new jGlobals.jpipExceptions.ArgumentException(
                        'progressiveness[' + i + '].minNumQualityLayers',
                        minNumQualityLayers,
                        'minNumQualityLayers is bigger than ' +
                            'fetchParams.quality');
                }
                
                minNumQualityLayers = validateNumericParam(
                    minNumQualityLayers,
                    propertyName,
                    'progressiveness[' + i + '].minNumQualityLayers');
            }
            
            result[i] = { minNumQualityLayers: minNumQualityLayers };
        }
        
        return result;
    }

    function getAutomaticProgressivenessStages(quality) {
        // Create progressiveness of (1, 2, 3, (#max-quality/2), (#max-quality))

        var progressiveness = [];

        // No progressiveness, wait for all quality layers to be fetched
        var tileStructure = codestreamStructure.getDefaultTileStructure();
        var numQualityLayersNumeric = tileStructure.getNumQualityLayers();
        var qualityNumericOrMax = 'max';
        
        if (quality !== undefined) {
            numQualityLayersNumeric = Math.min(
                numQualityLayersNumeric, quality);
            qualityNumericOrMax = numQualityLayersNumeric;
        }
        
        var firstQualityLayersCount = numQualityLayersNumeric < 4 ?
            numQualityLayersNumeric - 1: 3;
        
        for (var i = 1; i < firstQualityLayersCount; ++i) {
            progressiveness.push({ minNumQualityLayers: i });
        }
        
        var middleQuality = Math.round(numQualityLayersNumeric / 2);
        if (middleQuality > firstQualityLayersCount) {
            progressiveness.push({ minNumQualityLayers: middleQuality });
        }
        
        progressiveness.push({
            minNumQualityLayers: qualityNumericOrMax
            });
        
        return progressiveness;
    }

    function castCodestreamPartParams(codestreamPartParams) {
        var level = validateNumericParam(
            codestreamPartParams.level,
            'level',
            /*defaultValue=*/undefined,
            /*allowUndefiend=*/true);

        var quality = validateNumericParam(
            codestreamPartParams.quality,
            'quality',
            /*defaultValue=*/undefined,
            /*allowUndefiend=*/true);
        
        var minX = validateNumericParam(codestreamPartParams.minX, 'minX');
        var minY = validateNumericParam(codestreamPartParams.minY, 'minY');
        
        var maxX = validateNumericParam(
            codestreamPartParams.maxXExclusive, 'maxXExclusive');
        
        var maxY = validateNumericParam(
            codestreamPartParams.maxYExclusive, 'maxYExclusive');
        
        var levelWidth = codestreamStructure.getLevelWidth(level);
        var levelHeight = codestreamStructure.getLevelHeight(level);
        
        if (minX < 0 || maxX > levelWidth ||
            minY < 0 || maxY > levelHeight ||
            minX >= maxX || minY >= maxY) {
            
            throw new jGlobals.jpipExceptions.ArgumentException(
                'codestreamPartParams', codestreamPartParams);
        }
        
        var result = {
            minX: minX,
            minY: minY,
            maxXExclusive: maxX,
            maxYExclusive: maxY,
            
            level: level,
            quality: quality
            };
        
        return result;
    }

    function validateNumericParam(
        inputValue, propertyName, defaultValue, allowUndefined) {
        
        if (inputValue === undefined &&
            (defaultValue !== undefined || allowUndefined)) {
            
            return defaultValue;
        }
        
        var result = +inputValue;
        if (isNaN(result) || result !== Math.floor(result)) {
            throw new jGlobals.jpipExceptions.ArgumentException(
                propertyName, inputValue);
        }
        
        return result;
    }
}
},{"j2k-jpip-globals.js":16}],15:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports.JpipTileStructure = function JpipTileStructure(
    sizeParams,
    codestreamStructure,
    jpipFactory,
    progressionOrder
    ) {
    
    var defaultComponentStructure;
    var componentStructures;
    var componentToInClassLevelStartIndex;
    var minNumResolutionLevels;

    this.getProgressionOrder = function() {
        return progressionOrder;
    };
    
    this.getDefaultComponentStructure = function getDefaultComponentStructure(component) {
        return defaultComponentStructure;
    };
    
    this.getComponentStructure = function getComponentStructure(component) {
        return componentStructures[component];
    };
    
    this.getTileWidth = function getTileWidthClosure() {
        return sizeParams.tileSize[0];
    };
    
    this.getTileHeight = function getTileHeightClosure() {
        return sizeParams.tileSize[1];
    };
    
    this.getNumQualityLayers = function getNumQualityLayers() {
        return sizeParams.numQualityLayers;
    };
    
    this.getIsPacketHeaderNearData = function getIsPacketHeaderNearData() {
        return sizeParams.isPacketHeadersNearData;
    };
    
    this.getIsStartOfPacketMarkerAllowed = function getIsStartOfPacketMarkerAllowed() {
        return sizeParams.isStartOfPacketMarkerAllowed;
    };
    
    this.getIsEndPacketHeaderMarkerAllowed =
        function getIsEndPacketHeaderMarkerAllowed() {
        
        return sizeParams.isEndPacketHeaderMarkerAllowed;
    };
    
    this.precinctInClassIndexToPosition = function(inClassIndex) {
        // A.3.2
        
        if (inClassIndex < 0) {
            throw new jGlobals.jpipExceptions.ArgumentException(
                'inClassIndex',
                inClassIndex,
                'Invalid negative in-class index of precinct');
        }
        
        var numTiles = codestreamStructure.getNumTilesX() * codestreamStructure.getNumTilesY();
        var numComponents = codestreamStructure.getNumComponents();

        var tileIndex = inClassIndex % numTiles;
        var inClassIndexWithoutTile = (inClassIndex - tileIndex) / numTiles;
        
        var component = inClassIndexWithoutTile % numComponents;
        var componentStructure = componentStructures[component];
        
        var numResolutionLevels = componentStructure.getNumResolutionLevels();
        var precinctIndex = (inClassIndexWithoutTile - component) / numComponents;
        
        var resolutionLevel;
        var levelStartIndex = 0;
        for (resolutionLevel = 1; resolutionLevel < numResolutionLevels; ++resolutionLevel) {
            var nextLevelStartIndex =
                componentToInClassLevelStartIndex[component][resolutionLevel];
            
            if (nextLevelStartIndex > precinctIndex) {
                break;
            }
            
            levelStartIndex = nextLevelStartIndex;
        }
        
        --resolutionLevel;
        var precinctIndexInLevel = precinctIndex - levelStartIndex;
        
        var precinctsX = componentStructure.getNumPrecinctsX(resolutionLevel);
        var precinctsY = componentStructure.getNumPrecinctsY(resolutionLevel);

        var precinctX = precinctIndexInLevel % precinctsX;
        var precinctY = (precinctIndexInLevel - precinctX) / precinctsX;
        
        if (precinctY >= precinctsY) {
            throw new jGlobals.jpipExceptions.ArgumentException(
                'inClassIndex',
                inClassIndex,
                'Invalid in-class index of precinct');
        }
        
        var result = {
            tileIndex: tileIndex,
            component: component,
            
            precinctX: precinctX,
            precinctY: precinctY,
            resolutionLevel: resolutionLevel
            };
        
        return result;
    };
    
    this.precinctPositionToInClassIndex = function(precinctPosition) {
        // A.3.2

        var numComponents = codestreamStructure.getNumComponents();
        validateArgumentInRange(
            'precinctPosition.component', precinctPosition.component, numComponents);
        
        var componentStructure = componentStructures[precinctPosition.component];

        var numResolutionLevels = componentStructure.getNumResolutionLevels();
        validateArgumentInRange(
            'precinctPosition.resolutionLevel', precinctPosition.resolutionLevel, numResolutionLevels);

        var numTiles = codestreamStructure.getNumTilesX() * codestreamStructure.getNumTilesY();
        var precinctsX = componentStructure.getNumPrecinctsX(precinctPosition.resolutionLevel);
        var precinctsY = componentStructure.getNumPrecinctsY(precinctPosition.resolutionLevel);
        
        validateArgumentInRange(
            'precinctPosition.precinctX', precinctPosition.precinctX, precinctsX);
        validateArgumentInRange(
            'precinctPosition.precinctY', precinctPosition.precinctY, precinctsY);
        validateArgumentInRange(
            'precinctPosition.tileIndex', precinctPosition.tileIndex, numTiles);

        var precinctIndexInLevel = precinctPosition.precinctX + 
            precinctPosition.precinctY * precinctsX;
        
        var levelStartIndex = componentToInClassLevelStartIndex[precinctPosition.component][precinctPosition.resolutionLevel];
        
        var precinctIndex = precinctIndexInLevel + levelStartIndex;

        var inClassIndexWithoutTile =
            precinctPosition.component + precinctIndex * codestreamStructure.getNumComponents();

        var inClassIndex = precinctPosition.tileIndex + 
            inClassIndexWithoutTile * codestreamStructure.getNumTilesX() * codestreamStructure.getNumTilesY();
        
        return inClassIndex;
    };
    
    this.getPrecinctIterator = function getPrecinctIterator(
        tileIndex, codestreamPartParams, isIteratePrecinctsNotInCodestreamPart) {
        
        var level = 0;
        if (codestreamPartParams !== undefined &&
            codestreamPartParams.level !== undefined) {
            
            level = codestreamPartParams.level;
            
            if (minNumResolutionLevels <= level) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Cannot advance resolution: level=' +
                    codestreamPartParams.level + ' but should ' +
                    'be smaller than ' + minNumResolutionLevels);
            }
        }

        var precinctsInCodestreamPartPerLevelPerComponent =
            getPrecinctsInCodestreamPartPerLevelPerComponent(
                tileIndex, codestreamPartParams);
                
        var precinctX = 0;
        var precinctY = 0;
        if (!isIteratePrecinctsNotInCodestreamPart &&
            precinctsInCodestreamPartPerLevelPerComponent !== null) {
            
            var firstPrecinctsRange =
                precinctsInCodestreamPartPerLevelPerComponent[0][0];
            precinctX = firstPrecinctsRange.minPrecinctX;
            precinctY = firstPrecinctsRange.minPrecinctY;
        }
        
        // A.6.1 in part 1: Core Coding System
        
        var setableIterator = {
            component: 0,
            precinctX: precinctX,
            precinctY: precinctY,
            resolutionLevel: 0,
            isInCodestreamPart: true
            };

        var iterator = {
            get tileIndex() { return tileIndex; },
            get component() { return setableIterator.component; },
            get precinctIndexInComponentResolution() {
                var componentStructure = componentStructures[setableIterator.component];
                var precinctsX = componentStructure.getNumPrecinctsX(
                    setableIterator.resolutionLevel);
                setableIterator.precinctIndexInComponentResolution =
                    setableIterator.precinctX + setableIterator.precinctY * precinctsX;
        
                return setableIterator.precinctIndexInComponentResolution;
            },
                
            get precinctX() { return setableIterator.precinctX; },
            get precinctY() { return setableIterator.precinctY; },
            get resolutionLevel() { return setableIterator.resolutionLevel; },
            get isInCodestreamPart() { return setableIterator.isInCodestreamPart; }
            };
        
        iterator.tryAdvance = function tryAdvance() {
            var isSucceeded = tryAdvancePrecinctIterator(
                setableIterator,
                level,
                precinctsInCodestreamPartPerLevelPerComponent,
                isIteratePrecinctsNotInCodestreamPart);
            
            return isSucceeded;
        };
        
        return iterator;
    };
    
    function validateArgumentInRange(paramName, paramValue, suprimumParamValue) {
        if (paramValue < 0 || paramValue >= suprimumParamValue) {
            throw new jGlobals.jpipExceptions.ArgumentException(
                paramName,
                paramValue,
                paramName + ' is expected to be between 0 and ' + suprimumParamValue - 1);
        }
    }
    
    function validateTargetProgressionOrder(progressionOrder) {
        if (progressionOrder.length !== 4) {
            throw new jGlobals.j2kExceptions.IllegalDataException('Illegal progression order ' + progressionOrder + ': unexpected length');
        }
        
        if (progressionOrder[3] !== 'L') {
            throw new jGlobals.jpipExceptions.IllegalDataException('Illegal target progression order of ' + progressionOrder, 'A.3.2.1');
        }
        
        var hasP = progressionOrder.indexOf('P') >= 0;
        var hasC = progressionOrder.indexOf('C') >= 0;
        var hasR = progressionOrder.indexOf('R') >= 0;
        if (!hasP || !hasC || !hasR) {
            throw new jGlobals.j2kExceptions.IllegalDataException('Illegal progression order ' + progressionOrder + ': missing letter');
        }
        
        if (progressionOrder !== 'RPCL') {
            throw new jGlobals.j2kExceptions.UnsupportedFeatureException('Progression order of ' + progressionOrder, 'A.6.1');
        }
    }
    
    function preprocessParams() {
        componentToInClassLevelStartIndex = new Array(components);

        var components = codestreamStructure.getNumComponents();
        
        var defaultComponent = sizeParams.defaultComponentParams;
        minNumResolutionLevels = defaultComponent.numResolutionLevels;
        var isComponentsIdenticalSize = true;
        var isPrecinctPartitionFitsToTilePartition = true;

        for (var c = 0; c < components; ++c) {
            var size = sizeParams.paramsPerComponent[c];
            minNumResolutionLevels = Math.min(
                minNumResolutionLevels, size.numResolutionLevels);
                
            componentToInClassLevelStartIndex[c] = new Array(size.numResolutionLevels);
            var componentStructure = componentStructures[c];
            
            var accumulatedOffset = 0;
            var firstLevelPrecinctsX = componentStructure.getNumPrecinctsX(c);
            var firstLevelPrecinctsY = componentStructure.getNumPrecinctsY(c);
            
            for (var r = 0; r < size.numResolutionLevels; ++r) {
                componentToInClassLevelStartIndex[c][r] = accumulatedOffset;
                var precinctsXInLevel = componentStructure.getNumPrecinctsX(r);
                var precinctsYInLevel = componentStructure.getNumPrecinctsY(r);
                accumulatedOffset += precinctsXInLevel * precinctsYInLevel;
            
                if (defaultComponent.precinctWidthPerLevel[r] !==
                        size.precinctWidthPerLevel[r] ||
                    defaultComponent.precinctHeightPerLevel[r] !==
                        size.precinctHeightPerLevel[r]) {
                    
                    isComponentsIdenticalSize = false;
                }
                
                var isHorizontalPartitionSupported =
                    checkIfPrecinctPartitionStartsInTileTopLeft(
                        r,
                        size.numResolutionLevels,
                        componentStructure.getPrecinctWidth,
                        codestreamStructure.getLevelWidth,
                        codestreamStructure.getTileWidth);
                        
                var isVerticalPartitionSupported =
                    checkIfPrecinctPartitionStartsInTileTopLeft(
                        r,
                        size.numResolutionLevels,
                        componentStructure.getPrecinctWidth,
                        codestreamStructure.getLevelWidth,
                        codestreamStructure.getTileWidth);
                        
                isPrecinctPartitionFitsToTilePartition &=
                    isHorizontalPartitionSupported &&
                    isVerticalPartitionSupported;
            }
        }

        if (!isComponentsIdenticalSize) {
            throw new jGlobals.j2kExceptions.UnsupportedFeatureException(
                'Special Coding Style for Component (COC)', 'A.6.2');
        }
        
        if (!isPrecinctPartitionFitsToTilePartition) {
            throw new jGlobals.j2kExceptions.UnsupportedFeatureException(
                'Precinct TopLeft which is not matched to tile TopLeft', 'B.6');
        }
    }
    
    function checkIfPrecinctPartitionStartsInTileTopLeft(
        resolutionLevel,
        numResolutionLevels,
        getPrecinctSizeFunction,
        getLevelSizeFunction,
        getTileSizeFunction) {
        
        // Jpeg2000 standard allows partition of tiles which does not fit
        // exactly the precincts partition (i.e. the first precincts "virtually"
        // starts before the tile, thus is smaller than other).
        // This is not supported now in the code, this function should check
        // that this is not the situation.
        
        // The function assumes that firstTileOffset is zero and componentScale
        // is one (UnsupportedExceptions are thrown in ComponentStructure and
        // CodestreamStructure classes).
        
        var precinctSize = getPrecinctSizeFunction(resolutionLevel);
        var levelSize = getLevelSizeFunction(resolutionLevel);
        var tileSize = getTileSizeFunction(resolutionLevel);
        
        if (precinctSize >= levelSize || tileSize >= levelSize) {
            // precinctSize >= levelSize ==> Precinct is larger than image thus
            // anyway tile has a single precinct
            // tileSize >= levelSize ==> Level has only single tile thus no
            // chances for tile top-left to not match first precinct top-left
            
            return true;
        }
        
        var isPrecinctPartitionFitsToTilePartition =
            precinctSize % tileSize === 0 ||
            tileSize % precinctSize === 0;
        
        return isPrecinctPartitionFitsToTilePartition;
    }
    
    function getPrecinctsInCodestreamPartPerLevelPerComponent(
        tileIndex, codestreamPartParams) {
        
        if (codestreamPartParams === undefined) {
            return null;
        }
        
        var components = codestreamStructure.getNumComponents();
        var perComponentResult = new Array(components);
        var minLevel =
            codestreamPartParams.level || 0;
        
        var tileLeftInLevel = codestreamStructure.getTileLeft(
            tileIndex, minLevel);
        var tileTopInLevel = codestreamStructure.getTileTop(
            tileIndex, minLevel);
        
        var minXInTile =
            codestreamPartParams.minX - tileLeftInLevel;
        var minYInTile =
            codestreamPartParams.minY - tileTopInLevel;
        var maxXInTile =
            codestreamPartParams.maxXExclusive - tileLeftInLevel;
        var maxYInTile =
            codestreamPartParams.maxYExclusive - tileTopInLevel;
        
        var codestreamPartLevelWidth = codestreamStructure.getLevelWidth(
            minLevel);
        var codestreamPartLevelHeight = codestreamStructure.getLevelHeight(
            minLevel);

        for (var component = 0; component < components; ++component) {
            var componentStructure = componentStructures[component];
            var levels = componentStructure.getNumResolutionLevels();
            var levelsInCodestreamPart = levels - minLevel;
            var numResolutionLevels = componentStructure.getNumResolutionLevels();
            var perLevelResult = new Array(levels);
        
            for (var level = 0; level < levelsInCodestreamPart; ++level) {
                var componentScaleX = componentStructure.getComponentScaleX();
                var componentScaleY = componentStructure.getComponentScaleY();
                var levelInCodestreamPart = levelsInCodestreamPart - level - 1;
                var levelScaleX = componentScaleX << levelInCodestreamPart;
                var levelScaleY = componentScaleY << levelInCodestreamPart;
                
                var redundant = 4; // Redundant pixels for wavelet 9-7 convolution
                var minXInLevel = Math.floor(minXInTile / levelScaleX) - redundant;
                var minYInLevel = Math.floor(minYInTile / levelScaleY) - redundant;
                var maxXInLevel = Math.ceil(maxXInTile / levelScaleX) + redundant;
                var maxYInLevel = Math.ceil(maxYInTile / levelScaleY) + redundant;
                
                var precinctWidth =
                    componentStructure.getPrecinctWidth(level) * componentScaleX;
                var precinctHeight =
                    componentStructure.getPrecinctHeight(level) * componentScaleY;
                
                var minPrecinctX = Math.floor(minXInLevel / precinctWidth);
                var minPrecinctY = Math.floor(minYInLevel / precinctHeight);
                var maxPrecinctX = Math.ceil(maxXInLevel / precinctWidth);
                var maxPrecinctY = Math.ceil(maxYInLevel / precinctHeight);
                
                var precinctsX = componentStructure.getNumPrecinctsX(level);
                var precinctsY = componentStructure.getNumPrecinctsY(level);
                
                perLevelResult[level] = {
                    minPrecinctX: Math.max(0, minPrecinctX),
                    minPrecinctY: Math.max(0, minPrecinctY),
                    maxPrecinctXExclusive: Math.min(maxPrecinctX, precinctsX),
                    maxPrecinctYExclusive: Math.min(maxPrecinctY, precinctsY)
                    };
            }
            
            perComponentResult[component] = perLevelResult;
        }
        
        return perComponentResult;
    }
    
    function tryAdvancePrecinctIterator(
        setableIterator,
        level,
        precinctsInCodestreamPartPerLevelPerComponent,
        isIteratePrecinctsNotInCodestreamPart) {
        
        var needAdvanceNextMember = true;
        var precinctsRangeHash = isIteratePrecinctsNotInCodestreamPart ?
            null: precinctsInCodestreamPartPerLevelPerComponent;
        
        var needResetPrecinctToMinimalInCodestreamPart = false;
        
        for (var i = 2; i >= 0; --i) {
            var newValue = advanceProgressionOrderMember(
                setableIterator, i, level, precinctsRangeHash);
            
            needAdvanceNextMember = newValue === 0;
            if (!needAdvanceNextMember) {
                break;
            }
            
            if (progressionOrder[i] === 'P' &&
                !isIteratePrecinctsNotInCodestreamPart) {
                
                needResetPrecinctToMinimalInCodestreamPart = true;
            }
        }
        
        if (needAdvanceNextMember) {
            // If we are here, the last precinct has been reached
            return false;
        }
        
        if (precinctsInCodestreamPartPerLevelPerComponent === null) {
            setableIterator.isInCodestreamPart = true;
            return true;
        }
        
        var rangePerLevel =
            precinctsInCodestreamPartPerLevelPerComponent[setableIterator.component];
        var precinctsRange = rangePerLevel[setableIterator.resolutionLevel];
        
        if (needResetPrecinctToMinimalInCodestreamPart) {
            setableIterator.precinctX = precinctsRange.minPrecinctX;
                setableIterator.precinctY = precinctsRange.minPrecinctY;
        }
        
        setableIterator.isInCodestreamPart =
            setableIterator.precinctX >= precinctsRange.minPrecinctX &&
            setableIterator.precinctY >= precinctsRange.minPrecinctY &&
            setableIterator.precinctX < precinctsRange.maxPrecinctXExclusive &&
            setableIterator.precinctY < precinctsRange.maxPrecinctYExclusive;
        
        return true;
    }
    
    function advanceProgressionOrderMember(
        precinctPosition,
        memberIndex,
        level,
        precinctsRange) {
        
        var componentStructure = componentStructures[precinctPosition.component];
        
        switch (progressionOrder[memberIndex]) {
            case 'R':
                var numResolutionLevels =
                    componentStructure.getNumResolutionLevels() -
                    level;
                
                ++precinctPosition.resolutionLevel;
                precinctPosition.resolutionLevel %= numResolutionLevels;
                return precinctPosition.resolutionLevel;
            
            case 'C':
                ++precinctPosition.component;
                precinctPosition.component %= codestreamStructure.getNumComponents();
                return precinctPosition.component;
            
            case 'P':
                var minX, minY, maxX, maxY;
                if (precinctsRange !== null) {
                    var precinctsRangePerLevel = precinctsRange[
                        precinctPosition.component];
                    var precinctsRangeInLevelComponent = precinctsRangePerLevel[
                        precinctPosition.resolutionLevel];
                    
                    minX = precinctsRangeInLevelComponent.minPrecinctX;
                    minY = precinctsRangeInLevelComponent.minPrecinctY;
                    maxX = precinctsRangeInLevelComponent.maxPrecinctXExclusive;
                    maxY = precinctsRangeInLevelComponent.maxPrecinctYExclusive;
                } else {
                    minX = 0;
                    minY = 0;
                    maxX = componentStructure.getNumPrecinctsX(
                        precinctPosition.resolutionLevel);
                    maxY = componentStructure.getNumPrecinctsY(
                        precinctPosition.resolutionLevel);
                }
                
                precinctPosition.precinctX -= (minX - 1);
                precinctPosition.precinctX %= (maxX - minX);
                precinctPosition.precinctX += minX;
                
                if (precinctPosition.precinctX != minX) {
                    return precinctPosition.precinctX - minX;
                }
                
                precinctPosition.precinctY -= (minY - 1);
                precinctPosition.precinctY %= (maxY - minY);
                precinctPosition.precinctY += minY;

                return precinctPosition.precinctY - minY;
            
            case 'L' :
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Advancing L is not supported in JPIP');
            
            default:
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Unexpected letter in progression order: ' +
                    progressionOrder[memberIndex]);
        }
    }
    
    defaultComponentStructure = jpipFactory.createComponentStructure(
        sizeParams.defaultComponentParams, this);
        
    componentStructures = new Array(codestreamStructure.getNumComponents());
    for (var i = 0; i < codestreamStructure.getNumComponents(); ++i) {
        componentStructures[i] = jpipFactory.createComponentStructure(
            sizeParams.paramsPerComponent[i], this);
    }
    
    preprocessParams();
    
    validateTargetProgressionOrder(progressionOrder);

    return this;
};
},{"j2k-jpip-globals.js":16}],16:[function(require,module,exports){
'use strict';

module.exports.j2kMarkers = {
    StartOfCodestream: [0xFF, 0x4F], // SOC
    ImageAndTileSize: [0xFF, 0x51], // SIZ
    CodingStyleDefault: [0xFF, 0x52], // COD
    CodingStyleComponent: [0xFF, 0x53], // COC
    QuantizationDefault: [0xFF, 0x5C], // QCD
    ProgressionOrderChange: [0xFF, 0x5F], // POC
    PackedPacketHeadersInMainHeader: [0xFF, 0x60], // PPM
    PackedPacketHeadersInTileHeader: [0xFF, 0x61], // PPT
    StartOfTile: [0xFF, 0x90], // SOT
    StartOfData: [0xFF, 0x93], // SOD
    EndOfCodestream: [0xFF, 0xD9], // EOC
    Comment: [0xFF, 0x64] // COM
};

module.exports.j2kOffsets = {
    MARKER_SIZE: 2,
    LENGTH_FIELD_SIZE: 2,
    
    NUM_COMPONENTS_OFFSET_AFTER_SIZ_MARKER: 38,
    REFERENCE_GRID_SIZE_OFFSET_AFTER_SIZ_MARKER: 6

};

module.exports.jpipEndOfResponseReasons = {
    IMAGE_DONE : 1,
    WINDOW_DONE : 2,
    WINDOW_CHANGE : 3,
    BYTE_LIMIT : 4,
    QUALITY_LIMIT : 5,
    SESSION_LIMIT : 6,
    RESPONSE_LIMIT : 7,
    NON_SPECIFIED : 8
};

module.exports.j2kExceptions = {
    UnsupportedFeatureException: function(feature, standardSection) {
        this.description = feature + ' (specified in section ' + standardSection + ' of part 1: Core Coding System standard) is not supported yet';
        
        this.toString = function() {
            return 'J2k UnsupportedFeatureException: ' + this.description;
        };
        
        return this;
    },

    ParseException: function(description) {
        this.description = description;
        
        this.toString = function() {
            return 'J2k ParseException: ' + this.description;
        };
        
        return this;
    },

    IllegalDataException: function(illegalDataDescription, standardSection) {
        this.description = illegalDataDescription + ' (see section ' + standardSection + ' of part 9: Interactivity tools, APIs and Protocols)';
        
        this.toString = function() {
            return 'J2k IllegalDataException: ' + this.description;
        };
        
        return this;
    }
};

module.exports.jpipExceptions = {
    UnsupportedFeatureException: function(feature, standardSection) {
        this.description = feature + ' (specified in section ' + standardSection + ' of part 9: Interactivity tools, APIs and Protocols) is not supported yet';
        
        this.toString = function() {
            return 'Jpip UnsupportedFeatureException: ' + this.description;
        };
        
        return this;
    },

    ParseException: function(description) {
        this.description = description;
        
        this.toString = function() {
            return 'Jpip ParseException: ' + this.description;
        };
        
        return this;
    },

    IllegalDataException: function(illegalDataDescription, standardSection) {
        this.description = illegalDataDescription + ' (see section ' + standardSection + ' of part 9: Interactivity tools, APIs and Protocols)';
        
        this.toString = function() {
            return 'Jpip IllegalDataException: ' + this.description;
        };
        
        return this;
    },
    
    IllegalOperationException: function(description) {
        this.description = description;
        
        this.toString = function() {
            return 'Jpip IllegalOperationException: ' + this.description;
        };
        
        return this;
    },
    
    ArgumentException: function(argumentName, argumentValue, description) {
        this.description = 'Argument ' + argumentName + ' has invalid value ' +
            argumentValue + (description !== undefined ? ' :' + description : '');
        
        this.toString = function() {
            return 'Jpip ArgumentException: ' + this.description;
        };
        
        return this;
    },

    WrongStreamException: function(requestedOperation, isJPT) {
        var correctStream = 'JPP (JPIP Precinct)';
        var wrongStream = 'JPT (JPIP Tile-part)';
        
        if (isJPT) {
            var swap = correctStream;
            correctStream = wrongStream;
            wrongStream = swap;
        }
        
        this.description =    'Stream type is ' + wrongStream + ', but ' + requestedOperation +
                            ' is allowed only in ' + correctStream + ' stream';
                            
        this.toString = function() {
            return 'Jpip WrongStreamException: ' + this.description;
        };
        
        return this;
    },

    InternalErrorException: function(description) {
        this.description = description;
        
        this.toString = function() {
            return 'Jpip InternalErrorException: ' + this.description;
        };
        
        return this;
    }
};

module.exports.j2kExceptions.UnsupportedFeatureException.Name =
    'j2kExceptions.UnsupportedFeatureException';
module.exports.j2kExceptions.ParseException.Name =
    'j2kExceptions.ParseException';
module.exports.j2kExceptions.IllegalDataException.Name =
    'j2kExceptions.IllegalDataException';

module.exports.jpipExceptions.UnsupportedFeatureException.Name =
    'jpipExceptions.UnsupportedFeatureException';
module.exports.jpipExceptions.ParseException.Name =
    'jpipExceptions.ParseException';
module.exports.jpipExceptions.IllegalDataException.Name =
    'jpipExceptions.IllegalDataException';
module.exports.jpipExceptions.IllegalOperationException.Name =
    'jpipExceptions.IllegalOperationException';
module.exports.jpipExceptions.ArgumentException.Name =
    'jpipExceptions.ArgumentException';
module.exports.jpipExceptions.WrongStreamException.Name =
    'jpipExceptions.WrongStreamException';
module.exports.jpipExceptions.InternalErrorException.Name =
    'jpipExceptions.InternalErrorException';
},{}],17:[function(require,module,exports){
'use strict';

var simpleAjaxHelper                 = require('simple-ajax-helper.js'                 );
var mutualExclusiveTransactionHelper = require('mutual-exclusive-transaction-helper.js');

var jpipCodingPassesNumberParser = require('jpip-coding-passes-number-parser.js');
var jpipMessageHeaderParser      = require('jpip-message-header-parser.js'      );

var JpipChannel                               = require('jpip-channel.js'                                   );
var JpipCodestreamReconstructor               = require('jpip-codestream-reconstructor.js'                  );
var JpipCodestreamStructure                   = require('jpip-codestream-structure.js'                      );
var JpipComponentStructure                    = require('jpip-component-structure.js'                       );
var CompositeArray                            = require('composite-array.js'                                );
var JpipDatabinParts                          = require('jpip-databin-parts.js'                             );
var JpipDatabinsSaver                         = require('jpip-databins-saver.js'                            );
var JpipFetch                                 = require('jpip-fetch.js'                                     );
var JpipHeaderModifier                        = require('jpip-header-modifier.js'                           );
var JpipImageDataContext                      = require('jpip-image-data-context.js'                        );
var JpipLevelCalculator                       = require('jpip-level-calculator.js'                          );
var JpipMarkersParser                         = require('jpip-markers-parser.js'                            );
var JpipObjectPoolByDatabin                   = require('jpip-object-pool-by-databin.js'                    );
var JpipOffsetsCalculator                     = require('jpip-offsets-calculator.js'                        );
var JpipPacketsDataCollector                  = require('jpip-packets-data-collector.js'                    );
var JpipRequestDatabinsListener               = require('jpip-request-databins-listener.js'                 );
var JpipRequestParamsModifier                 = require('jpip-request-params-modifier.js'                   );
var JpipRequest                               = require('jpip-request.js'                                   );
var JpipSessionHelper                         = require('jpip-session-helper.js'                            );
var JpipSession                               = require('jpip-session.js'                                   );
var JpipReconnectableRequester                = require('jpip-reconnectable-requester.js'                   );
var JpipStructureParser                       = require('jpip-structure-parser.js'                          );
var JpipTileStructure                         = require('jpip-tile-structure.js'                            );
var JpipBitstreamReader                       = require('jpip-bitstream-reader.js'                          );
var JpipTagTree                               = require('jpip-tag-tree.js'                                  );
var JpipCodeblockLengthParser                 = require('jpip-codeblock-length-parser.js'                   );
var JpipSubbandLengthInPacketHeaderCalculator = require('jpip-subband-length-in-packet-header-calculator.js');
var JpipPacketLengthCalculator                = require('jpip-packet-length-calculator.js'                  );
var JpipQualityLayersCache                    = require('jpip-quality-layers-cache.js'                      );

var JpipFetcher;

var jpipRuntimeFactory = {
    createChannel: function createChannel(
        maxRequestsWaitingForResponseInChannel, sessionHelper) {
        
        return new JpipChannel(
            maxRequestsWaitingForResponseInChannel,
            sessionHelper,
            jpipRuntimeFactory);
    },
    
    createCodestreamReconstructor: function(
        codestreamStructure, databinsSaver, headerModifier, qualityLayersCache) {
        
        return new JpipCodestreamReconstructor(
            codestreamStructure,
            databinsSaver,
            headerModifier,
            qualityLayersCache);
    },
    
    createLevelCalculator: function(params) {
        return new JpipLevelCalculator(params);
    },
    
    createCodestreamStructure: function(structureParser, progressionOrder) {
        return new JpipCodestreamStructure(
            structureParser, jpipRuntimeFactory, progressionOrder);
    },
    
    createComponentStructure: function(params, tileStructure) {
        return new JpipComponentStructure(params, tileStructure);
    },
    
    createCompositeArray: function(offset) {
        return new CompositeArray(offset);
    },
    
    createDatabinParts: function(classId, inClassId) {
        return new JpipDatabinParts(classId, inClassId, jpipRuntimeFactory);
    },
    
    createDatabinsSaver: function(isJpipTilepartStream) {
        return new JpipDatabinsSaver(isJpipTilepartStream, jpipRuntimeFactory);
    },
    
    createFetcher: function(databinsSaver, options) {
        if (!JpipFetcher) {
            // Avoid dependency - load only on runtime
            JpipFetcher = require('jpip-fetcher.js');
        }
        return new JpipFetcher(databinsSaver, options);
    },
    
    createFetch: function(fetchContext, requester, progressiveness) {
        return new JpipFetch(fetchContext, requester, progressiveness);
    },
    
    createHeaderModifier: function(
        codestreamStructure, offsetsCalculator, progressionOrder) {
        
        return new JpipHeaderModifier(
            codestreamStructure, offsetsCalculator, progressionOrder);
    },
    
    createImageDataContext: function(
        jpipObjects, codestreamPartParams, progressiveness) {
        
        return new JpipImageDataContext(
            jpipObjects, codestreamPartParams, progressiveness);
    },
    
    createMarkersParser: function(mainHeaderDatabin) {
        return new JpipMarkersParser(
            mainHeaderDatabin, jpipMessageHeaderParser, jpipRuntimeFactory);
    },
    
    createObjectPoolByDatabin: function() {
        return new JpipObjectPoolByDatabin();
    },
    
    createOffsetsCalculator: function(mainHeaderDatabin, markersParser) {
        return new JpipOffsetsCalculator(mainHeaderDatabin, markersParser);
    },
    
    createPacketsDataCollector: function(
        codestreamStructure, databinsSaver, qualityLayersCache) {
        
        return new JpipPacketsDataCollector(
            codestreamStructure,
            databinsSaver,
            qualityLayersCache,
            jpipRuntimeFactory);
    },
    
    createRequestDatabinsListener: function createRequestDatabinsListener(
        codestreamPartParams,
        qualityLayerReachedCallback,
        codestreamStructure,
        databinsSaver,
        qualityLayersCache) {
        
        return new JpipRequestDatabinsListener(
            codestreamPartParams,
            qualityLayerReachedCallback,
            codestreamStructure,
            databinsSaver,
            qualityLayersCache,
            jpipRuntimeFactory);
    },
    
    createRequestParamsModifier: function createRequestParamsModifier(
        codestreamStructure) {
        
        return new JpipRequestParamsModifier(codestreamStructure);
    },
    
    createRequest: function createRequest(
        sessionHelper, channel, requestUrl, callback, failureCallback) {
        
        return new JpipRequest(
            sessionHelper,
            jpipMessageHeaderParser,
            channel,
            requestUrl,
            callback,
            failureCallback);
    },
    
    createSessionHelper: function createSessionHelper(
        dataRequestUrl,
        knownTargetId,
        codestreamStructure,
        databinsSaver) {
        
        return new JpipSessionHelper(
            dataRequestUrl,
            knownTargetId,
            codestreamStructure,
            databinsSaver,
            simpleAjaxHelper);
    },
    
    createSession: function createSession(
        maxChannelsInSession,
        maxRequestsWaitingForResponseInChannel,
        targetId,
        codestreamStructure,
        databinsSaver) {
        
        return new JpipSession(
            maxChannelsInSession,
            maxRequestsWaitingForResponseInChannel,
            targetId,
            codestreamStructure,
            databinsSaver,
            setInterval,
            clearInterval,
            jpipRuntimeFactory);
    },
    
    createReconnectableRequester: function(
        maxChannelsInSession,
        maxRequestsWaitingForResponseInChannel,
        codestreamStructure,
        databinsSaver) {
        
        return new JpipReconnectableRequester(
            maxChannelsInSession,
            maxRequestsWaitingForResponseInChannel,
            codestreamStructure,
            databinsSaver,
            jpipRuntimeFactory);
    },
    
    createStructureParser: function(databinsSaver, markersParser, offsetsCalculator) {
        return new JpipStructureParser(
            databinsSaver, markersParser, jpipMessageHeaderParser, offsetsCalculator);
    },
    
    createTileStructure: function(
        sizeParams, codestreamStructure, progressionOrder) {
        return new JpipTileStructure(
            sizeParams, codestreamStructure, jpipRuntimeFactory, progressionOrder);
    },
    
    createBitstreamReader: function createBitstreamReader(databin) {
        return new JpipBitstreamReader(
            databin, mutualExclusiveTransactionHelper);
    },
    
    createTagTree: function createTagTree(bitstreamReader, width, height) {
        return new JpipTagTree(
            bitstreamReader, width, height, mutualExclusiveTransactionHelper);
    },
    
    createCodeblockLengthParser: function createCodeblockLengthParser(
        bitstreamReader, transactionHelper) {
        
        return new JpipCodeblockLengthParser(
            bitstreamReader, mutualExclusiveTransactionHelper);
    },
    
    createSubbandLengthInPacketHeaderCalculator :
        function createSubbandLengthInPacketHeaderCalculator(
            bitstreamReader, numCodeblocksXInSubband, numCodeblocksYInSubband) {
        
        return new JpipSubbandLengthInPacketHeaderCalculator(
            bitstreamReader,
            numCodeblocksXInSubband,
            numCodeblocksYInSubband,
            jpipCodingPassesNumberParser,
            mutualExclusiveTransactionHelper,
            jpipRuntimeFactory);
    },
    
    createPacketLengthCalculator: function createPacketLengthCalculator(
        tileStructure,
        componentStructure,
        databin,
        startOffsetInDatabin,
        precinct) {
        
        return new JpipPacketLengthCalculator(
            tileStructure,
            componentStructure,
            databin,
            startOffsetInDatabin,
            precinct,
            jpipRuntimeFactory);
    },
    
    createQualityLayersCache: function createQualityLayersCache(
        codestreamStructure) {
        
        return new JpipQualityLayersCache(
            codestreamStructure,
            jpipRuntimeFactory);
    }
};

module.exports = jpipRuntimeFactory;
},{"composite-array.js":7,"jpip-bitstream-reader.js":28,"jpip-channel.js":22,"jpip-codeblock-length-parser.js":29,"jpip-codestream-reconstructor.js":37,"jpip-codestream-structure.js":12,"jpip-coding-passes-number-parser.js":30,"jpip-component-structure.js":13,"jpip-databin-parts.js":8,"jpip-databins-saver.js":9,"jpip-fetch.js":1,"jpip-fetcher.js":2,"jpip-header-modifier.js":38,"jpip-image-data-context.js":3,"jpip-level-calculator.js":5,"jpip-markers-parser.js":19,"jpip-message-header-parser.js":23,"jpip-object-pool-by-databin.js":10,"jpip-offsets-calculator.js":20,"jpip-packet-length-calculator.js":31,"jpip-packets-data-collector.js":39,"jpip-quality-layers-cache.js":32,"jpip-reconnectable-requester.js":24,"jpip-request-databins-listener.js":11,"jpip-request-params-modifier.js":14,"jpip-request.js":25,"jpip-session-helper.js":26,"jpip-session.js":27,"jpip-structure-parser.js":21,"jpip-subband-length-in-packet-header-calculator.js":33,"jpip-tag-tree.js":34,"jpip-tile-structure.js":15,"mutual-exclusive-transaction-helper.js":35,"simple-ajax-helper.js":18}],18:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = {
    request: function request(
        url,
        callbackForAsynchronousRequest,
        failureCallbackForAsynchronousRequest,
        progressiveRequestQuantBytes) {
        
        var ajaxResponse = new XMLHttpRequest();
        var isSynchronous = callbackForAsynchronousRequest === undefined;

        var isFinishedRequest = false;
        var bytesRecievedOnLastQuant = 0;
        
        function internalAjaxCallback(e) {
            if (isFinishedRequest) {
                return;
            }
            
            if (ajaxResponse.readyState !== 4) {
                if (progressiveRequestQuantBytes === undefined ||
                    ajaxResponse.response === null ||
                    ajaxResponse.readyState < 3) {
                    
                    return;
                }
                
                var bytesRecieved = ajaxResponse.response.byteLength;
                var bytesTillLastQuant = bytesRecieved - bytesRecievedOnLastQuant;
                
                if (bytesTillLastQuant < progressiveRequestQuantBytes) {
                    return;
                }
                
                bytesRecievedOnLastQuant = bytesRecieved;
            } else {
                isFinishedRequest = true;
                
                if (ajaxResponse.status !== 200 ||
                    ajaxResponse.response === null) {
                    
                    failureCallbackForAsynchronousRequest(ajaxResponse);
                    return;
                }
            }
            
            if (!isSynchronous) {
                callbackForAsynchronousRequest(ajaxResponse, isFinishedRequest);
            }
        }
        
        ajaxResponse.open('GET', url, !isSynchronous);
        ajaxResponse.onreadystatechange = internalAjaxCallback;
        
        if (!isSynchronous) {
            // Not supported for synchronous requests
            ajaxResponse.mozResponseType = ajaxResponse.responseType = 'arraybuffer';
        }

        if (progressiveRequestQuantBytes !== undefined) {
            ajaxResponse.setRequestHeader('X-Content-Type-Options', 'nosniff');
            ajaxResponse.onprogress = internalAjaxCallback;
        }
        
        ajaxResponse.send(null);

        if (isSynchronous && !isFinishedRequest) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'synchronous ajax call was not finished synchronously');
        }
        
        return ajaxResponse;
    }
};
},{"j2k-jpip-globals.js":16}],19:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipMarkersParser(
    mainHeaderDatabin, messageHeaderParser, jpipFactory) {
    
    var CACHE_KEY = 'markers';
    
    this.getMandatoryMarkerOffsetInDatabin =
        function getMandatoryMarkerOffsetInDatabinClosure(
            databin, marker, markerName, standardSection) {
        
        var offset = getMarkerOffsetInDatabin(databin, marker);
        
        if (offset === null) {
            throw new jGlobals.j2kExceptions.IllegalDataException(
                markerName + ' is not found where expected to be',
                standardSection);
        }
        
        return offset;
    };
    
    this.checkSupportedMarkers = function checkSupportedMarkersClosure(
        databin, markers, isMarkersSupported) {
        
        isMarkersSupported = !!isMarkersSupported;
        
        var databinMarkers = getDatabinMarkers(
            databin, /*forceAllMarkersParsed=*/true);
        
        var markersAsProperties = {};
        for (var i = 0; i < markers.length; ++i) {
            var marker = getMarkerAsPropertyName(
                markers[i], 'jpipMarkersParser.supportedMarkers[' + i + ']');
            markersAsProperties[marker] = true;
        }
        
        for (var existingMarker in databinMarkers.markerToOffset) {
            var isMarkerInList = !!markersAsProperties[existingMarker];
            if (isMarkerInList !== isMarkersSupported) {
                throw new jGlobals.j2kExceptions.UnsupportedFeatureException(
                    'Unsupported marker found: ' + existingMarker, 'unknown');
            }
        }
    };
    
    this.getMarkerOffsetInDatabin = getMarkerOffsetInDatabin;
    
    this.isMarker = isMarker;
    
    function isMarker(data, marker, offset) {
        var result = (data[offset] === marker[0]) && (data[offset + 1] === marker[1]);
        
        return result;
    }

    function getMarkerOffsetInDatabin(databin, marker) {
        var databinMarkers = getDatabinMarkers(
            databin, /*forceAllMarkersParsed=*/true);
        
        var strMarker = getMarkerAsPropertyName(
            marker, 'Predefined marker in jGlobals.j2kMarkers');
        var offset = databinMarkers.markerToOffset[strMarker];
        
        if (offset === undefined) {
            return null;
        }
        
        return offset;
    }

    function getDatabinMarkers(databin, forceAllMarkersParsed) {
        var databinMarkers = databin.getCachedData(CACHE_KEY);
        
        if (databinMarkers.markerToOffset === undefined) {
            databinMarkers.isParsedAllMarkers = false;
            databinMarkers.lastOffsetParsed = 0;
            databinMarkers.markerToOffset = {};
            databinMarkers.databin = databin;
        }
        
        if (databinMarkers.isParsedAllMarkers) {
            return databinMarkers;
        }
        
        var startOffset = 0;
        var bytes = [];
        var canParse = true;

        if (databin === mainHeaderDatabin && databinMarkers.lastOffsetParsed === 0) {
            var bytesCopied = databin.copyBytes(bytes, /*startOffset=*/0, {
                forceCopyAllRange: true,
                maxLengthToCopy: jGlobals.j2kOffsets.MARKER_SIZE
                });
            
            if (bytesCopied === null) {
                canParse = false;
            } else if (!isMarker(bytes, jGlobals.j2kMarkers.StartOfCodestream, /*offset=*/0)) {
                throw new jGlobals.j2kExceptions.IllegalDataException(
                    'SOC (Start Of Codestream) ' +
                    'is not found where expected to be',
                    'A.4.1');
            }
            
            databinMarkers.lastOffsetParsed = 2;
        }

        if (canParse) {
            actualParseMarkers(databinMarkers);
        }
        
        afterParseMarkers(databinMarkers, forceAllMarkersParsed);
        
        return databinMarkers;
    }
    
    function actualParseMarkers(databinMarkers) {
        var offset = databinMarkers.lastOffsetParsed;
        
        var bytes = [];
        var bytesCopied = databinMarkers.databin.copyBytes(bytes, /*startOffset=*/0, {
                forceCopyAllRange: true,
                maxLengthToCopy: jGlobals.j2kOffsets.MARKER_SIZE + jGlobals.j2kOffsets.LENGTH_FIELD_SIZE,
                databinStartOffset: offset
                });
        
        while (bytesCopied !== null) {
            var marker = getMarkerAsPropertyName(
                bytes,
                'offset ' + offset + ' of databin with class ID = ' +
                    databinMarkers.databin.getClassId() + ' and in class ID = ' +
                    databinMarkers.databin.getInClassId());
            databinMarkers.markerToOffset[marker.toString()] = offset;
                
            var length = messageHeaderParser.getInt16(bytes, jGlobals.j2kOffsets.MARKER_SIZE);
            offset += length + jGlobals.j2kOffsets.MARKER_SIZE;
            
            bytesCopied = databinMarkers.databin.copyBytes(bytes, /*startOffset=*/0, {
                forceCopyAllRange: true,
                maxLengthToCopy: jGlobals.j2kOffsets.MARKER_SIZE + jGlobals.j2kOffsets.LENGTH_FIELD_SIZE,
                databinStartOffset: offset
                });
        }

        databinMarkers.lastOffsetParsed = offset;
    }
    
    function afterParseMarkers(databinMarkers, forceAllMarkersParsed) {
        var databinLength = databinMarkers.databin.getDatabinLengthIfKnown();
        databinMarkers.isParsedAllMarkers = databinMarkers.lastOffsetParsed === databinLength;
        
        if (!databinMarkers.isParsedAllMarkers && databinMarkers.databin !== mainHeaderDatabin) {
            var bytes = [];
            var bytesCopied = databinMarkers.databin.copyBytes(bytes, /*startOffset=*/0, {
                forceCopyAllRange: true,
                maxLengthToCopy: jGlobals.j2kOffsets.MARKER_SIZE,
                databinStartOffset: databinMarkers.lastOffsetParsed
                });
            
            if (bytesCopied !== null &&
                isMarker(bytes, 0, jGlobals.j2kMarkers.StartOfData)) {
                
                databinMarkers.lastOffsetParsed += jGlobals.j2kOffsets.MARKER_SIZE;
                databinMarkers.isParsedAllMarkers = true;
            }
        }
        
        if (forceAllMarkersParsed && !databinMarkers.isParsedAllMarkers) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'data-bin with class ID = ' +
                databinMarkers.databin.getClassId() + ' and in class ID = ' +
                databinMarkers.databin.getInClassId() +
                ' was not recieved yet');
        }
    }
    
    function getMarkerAsPropertyName(bytes, markerPositionDescription) {
        if (bytes[0] !== 0xFF) {
            throw new jGlobals.j2kExceptions.IllegalDataException(
                'Expected marker in ' + markerPositionDescription, 'A');
        }
        
        var marker = bytes[1].toString(16);
        return marker;
    }
};
},{"j2k-jpip-globals.js":16}],20:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipOffsetsCalculator(
    mainHeaderDatabin, markersParser) {
    
    var supportedMarkers = [
        jGlobals.j2kMarkers.ImageAndTileSize,
        jGlobals.j2kMarkers.CodingStyleDefault,
        jGlobals.j2kMarkers.QuantizationDefault,
        jGlobals.j2kMarkers.Comment
        ];
    
    this.getCodingStyleOffset = getCodingStyleOffset;
    
    this.getCodingStyleBaseParams = getCodingStyleBaseParams;
    
    this.getImageAndTileSizeOffset = function getImageAndTileSizeOffset() {
        // A.5.1 (Image and tile size marker segment)
        
        var sizMarkerOffset = markersParser.getMandatoryMarkerOffsetInDatabin(
            mainHeaderDatabin,
            jGlobals.j2kMarkers.ImageAndTileSize,
            'Image and Tile Size (SIZ)',
            'A.5.1');
        
        return sizMarkerOffset;
    };
    
    this.getRangesOfBestResolutionLevelsData =
        function getRangesWithDataOfResolutionLevelsClosure(
            databin, numResolutionLevels) {
        
        markersParser.checkSupportedMarkers(
            databin, supportedMarkers, /*isMarkersSupported=*/true);
        
        var numDecompositionLevelsOffset = null;
        
        var databinCodingStyleDefaultBaseParams = getCodingStyleBaseParams(
            databin, /*isMandatory=*/false);
        
        var databinOrMainHeaderCodingStyleBaseParams = databinCodingStyleDefaultBaseParams;
        if (databinCodingStyleDefaultBaseParams === null) {
            databinOrMainHeaderCodingStyleBaseParams = getCodingStyleBaseParams(
                mainHeaderDatabin, /*isMandatory=*/true);
        } else {
            numDecompositionLevelsOffset =
                databinCodingStyleDefaultBaseParams.numDecompositionLevelsOffset;
        }
        
        var codingStyleNumResolutionLevels = 
            databinOrMainHeaderCodingStyleBaseParams.numResolutionLevels;
            
        if (codingStyleNumResolutionLevels <= numResolutionLevels) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'numResolutionLevels (' + numResolutionLevels + ') <= COD.' +
                'numResolutionLevels (' + codingStyleNumResolutionLevels + ')');
        }

        var ranges = [];

        addRangeOfBestResolutionLevelsInCodingStyle(
            ranges, databinCodingStyleDefaultBaseParams, numResolutionLevels);

        addRangeOfBestResolutionLevelsInQuantization(
            ranges,
            databin,
            databinOrMainHeaderCodingStyleBaseParams,
            numResolutionLevels);

        var result = {
            ranges: ranges,
            numDecompositionLevelsOffset: numDecompositionLevelsOffset
            };
        
        return result;
    };
    
    function getCodingStyleBaseParams(
        databin, isMandatory) {
        
        var codingStyleDefaultOffset = getCodingStyleOffset(
            databin, isMandatory);
        
        if (codingStyleDefaultOffset === null) {
            return null;
        }
        
        var numBytes = 8;
        var bytesOffset = codingStyleDefaultOffset + jGlobals.j2kOffsets.MARKER_SIZE;
        var bytes = getBytes(databin, numBytes, bytesOffset);

        var codingStyleFlagsForAllComponentsOffset = 2; // Scod
        var codingStyleFlagsForAllComponents =
            bytes[codingStyleFlagsForAllComponentsOffset];
            
        var isDefaultPrecinctSize = !(codingStyleFlagsForAllComponents & 0x1);
        var isStartOfPacketMarkerAllowed = !!(codingStyleFlagsForAllComponents & 0x2);
        var isEndPacketHeaderMarkerAllowed = !!(codingStyleFlagsForAllComponents & 0x4);
        
        var numDecompositionLevelsOffsetInBytes = 7; // SPcod, 1st byte
        var numDecompositionLevels = bytes[numDecompositionLevelsOffsetInBytes];
        var numResolutionLevels = numDecompositionLevels + 1;
        
        var numDecompositionLevelsOffset = bytesOffset + numDecompositionLevelsOffsetInBytes;
        
        var precinctSizesOffset = isDefaultPrecinctSize ? null : codingStyleDefaultOffset + 14;
        
        var result = {
            codingStyleDefaultOffset: codingStyleDefaultOffset,
            
            isDefaultPrecinctSize: isDefaultPrecinctSize,
            isStartOfPacketMarkerAllowed: isStartOfPacketMarkerAllowed,
            isEndPacketHeaderMarkerAllowed: isEndPacketHeaderMarkerAllowed,
            
            numResolutionLevels: numResolutionLevels,
            precinctSizesOffset: precinctSizesOffset,
            numDecompositionLevelsOffset: numDecompositionLevelsOffset
            };
        
        return result;
    }
    
    function addRangeOfBestResolutionLevelsInCodingStyle(
        ranges, codingStyleDefaultBaseParams, numResolutionLevels) {
        
        if (codingStyleDefaultBaseParams === null ||
            codingStyleDefaultBaseParams.isDefaultPrecinctSize) {
            
            return;
        }
        
        var levelsNotInRange =
            codingStyleDefaultBaseParams.numResolutionLevels - numResolutionLevels;
        
        var firstOffsetInRange =
            codingStyleDefaultBaseParams.precinctSizesOffset + levelsNotInRange;
        
        var markerLengthOffset = 
            codingStyleDefaultBaseParams.codingStyleDefaultOffset + jGlobals.j2kOffsets.MARKER_SIZE;
        
        var precinctSizesRange = {
            markerSegmentLengthOffset: markerLengthOffset,
            start: firstOffsetInRange,
            length: numResolutionLevels
            };
        

        ranges.push(precinctSizesRange);
    }

    function getQuantizationDataBytesPerSubband(databin, quantizationStyleOffset) {
        var sqcdOffset = quantizationStyleOffset + 4; // Sqcd
        var bytes = getBytes(databin, /*numBytes=*/1, sqcdOffset);
        var quantizationStyle = bytes[0] & 0x1F;
        
        var bytesPerSubband;
        switch (quantizationStyle) {
            case 0:
                bytesPerSubband = 1;
                break;
            case 1:
                bytesPerSubband = 0;
                break;
            case 2:
                bytesPerSubband = 2;
                break;
            default:
                throw new jGlobals.j2kExceptions.IllegalDataException(
                    'Quantization style of ' + quantizationStyle, 'A.6.4');
        }
        
        return bytesPerSubband;
    }
    
    function addRangeOfBestResolutionLevelsInQuantization(
        ranges,
        databin,
        codingStyleDefaultBaseParams,
        numResolutionLevels) {
        
        var qcdMarkerOffset = markersParser.getMarkerOffsetInDatabin(
            databin, jGlobals.j2kMarkers.QuantizationDefault);
        
        if (qcdMarkerOffset === null) {
            return;
        }
        
        var bytesPerSubband = getQuantizationDataBytesPerSubband(
            databin, qcdMarkerOffset);
            
        if (bytesPerSubband === 0) {
            return;
        }
        
        var levelsNotInRange =
            codingStyleDefaultBaseParams.numResolutionLevels - numResolutionLevels;
        
        var subbandsNotInRange = 1 + 3 * (levelsNotInRange - 1);
        var subbandsInRange = 3 * numResolutionLevels;
        
        var firstOffsetInRange =
            qcdMarkerOffset + 5 + subbandsNotInRange * bytesPerSubband;
        
        var rangeLength = subbandsInRange * bytesPerSubband;
        
        var markerLengthOffset = qcdMarkerOffset + jGlobals.j2kOffsets.MARKER_SIZE;
        
        var quantizationsRange = {
            markerSegmentLengthOffset: markerLengthOffset,
            start: firstOffsetInRange,
            length: rangeLength
            };
        
        ranges.push(quantizationsRange);
    }
    
    function expectNoCodingStyleComponent(databin) {
        var cocOffset = markersParser.getMarkerOffsetInDatabin(
            databin, jGlobals.j2kMarkers.CodingStyleComponent);
        
        if (cocOffset !== null) {
            // A.6.2
            throw new jGlobals.j2kExceptions.UnsupportedFeatureException(
                'COC Marker (Coding Style Component)', 'A.6.2');
        }
    }
    
    function getCodingStyleOffset(databin, isMandatory) {
        expectNoCodingStyleComponent(databin);

        var offset;
        if (isMandatory) {
            offset = markersParser.getMandatoryMarkerOffsetInDatabin(
                databin,
                jGlobals.j2kMarkers.CodingStyleDefault,
                'COD (Coding style Default)',
                'A.6.1');
        } else {
            offset = markersParser.getMarkerOffsetInDatabin(
                databin, jGlobals.j2kMarkers.CodingStyleDefault);
        }
        
        return offset;
    }
    
    function getBytes(databin, numBytes, databinStartOffset, allowEndOfRange) {
        var bytes = [];

        var rangeOptions = {
            forceCopyAllRange: true,
            maxLengthToCopy: numBytes,
            databinStartOffset: databinStartOffset
            };
        
        var bytesCopied = databin.copyBytes(bytes, /*startOffset=*/0, rangeOptions);
        if (bytesCopied === null) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Header data-bin has not yet recieved ' + numBytes +
                ' bytes starting from offset ' + databinStartOffset);
        }
        
        return bytes;
    }
};
},{"j2k-jpip-globals.js":16}],21:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipStructureParser(
    databinsSaver, markersParser, messageHeaderParser, offsetsCalculator) {
    
    this.parseCodestreamStructure = function parseCodestreamStructure() {
        // A.5.1 (Image and Tile Size)
        
        var mainHeaderDatabin = databinsSaver.getMainHeaderDatabin();
        
        var sizMarkerOffset = offsetsCalculator.getImageAndTileSizeOffset();
        
        var bytes = getBytes(
            mainHeaderDatabin,
            /*numBytes=*/38,
            sizMarkerOffset + jGlobals.j2kOffsets.MARKER_SIZE + jGlobals.j2kOffsets.LENGTH_FIELD_SIZE);
        
        var referenceGridSizeOffset =
            jGlobals.j2kOffsets.REFERENCE_GRID_SIZE_OFFSET_AFTER_SIZ_MARKER -
            (jGlobals.j2kOffsets.MARKER_SIZE + jGlobals.j2kOffsets.LENGTH_FIELD_SIZE);
        var numComponentsOffset =
            jGlobals.j2kOffsets.NUM_COMPONENTS_OFFSET_AFTER_SIZ_MARKER -
            (jGlobals.j2kOffsets.MARKER_SIZE + jGlobals.j2kOffsets.LENGTH_FIELD_SIZE);
            
        var referenceGridSizeX = messageHeaderParser.getInt32(
            bytes, referenceGridSizeOffset); // XSiz
        var referenceGridSizeY = messageHeaderParser.getInt32(
            bytes, referenceGridSizeOffset + 4); // YSiz
            
        var imageOffsetX = messageHeaderParser.getInt32(bytes, 10); // XOSiz
        var imageOffsetY = messageHeaderParser.getInt32(bytes, 14); // YOSiz
        var tileSizeX = messageHeaderParser.getInt32(bytes, 18); // XTSiz
        var tileSizeY = messageHeaderParser.getInt32(bytes, 22); // YTSiz
        var firstTileOffsetX = messageHeaderParser.getInt32(bytes, 26); // XTOSiz
        var firstTileOffsetY = messageHeaderParser.getInt32(bytes, 30); // YTOSiz
        
        var numComponents = messageHeaderParser.getInt16(bytes, numComponentsOffset); // CSiz
        
        var componentsDataOffset =
            sizMarkerOffset + jGlobals.j2kOffsets.NUM_COMPONENTS_OFFSET_AFTER_SIZ_MARKER + 2;
        var componentsDataLength = numComponents * 3;
        
        var componentsDataBytes = getBytes(
            mainHeaderDatabin, componentsDataLength, componentsDataOffset);
        
        var componentsScaleX = new Array(numComponents);
        var componentsScaleY = new Array(numComponents);
        for (var i = 0; i < numComponents; ++i) {
            componentsScaleX[i] = componentsDataBytes[i * 3 + 1];
            componentsScaleY[i] = componentsDataBytes[i * 3 + 2];
        }
        
        var result = {
            numComponents: numComponents,
            componentsScaleX: componentsScaleX,
            componentsScaleY: componentsScaleY,
            imageWidth: referenceGridSizeX - firstTileOffsetX,
            imageHeight: referenceGridSizeY - firstTileOffsetY,
            tileWidth: tileSizeX,
            tileHeight: tileSizeY,
            firstTileOffsetX: firstTileOffsetX,
            firstTileOffsetY: firstTileOffsetY
        };
        return result;
    };
    
    this.parseDefaultTileParams = function() {
        var mainHeaderDatabin = databinsSaver.getMainHeaderDatabin();

        var tileParams = parseCodingStyle(mainHeaderDatabin, /*isMandatory=*/true);
        return tileParams;
    };
    
    this.parseOverridenTileParams = function(tileIndex) {
        var tileHeaderDatabin = databinsSaver.getTileHeaderDatabin(tileIndex);
        
        // A.4.2 (Start Of Tile-part)
        
        var tileParams = parseCodingStyle(tileHeaderDatabin, /*isMandatory=*/false);
        return tileParams;
    };

    function parseCodingStyle(databin, isMandatory) {
        // A.5.1 (Image and Tile Size)

        var baseParams = offsetsCalculator.getCodingStyleBaseParams(
            databin, isMandatory);
        
        if (baseParams === null) {
            return null;
        }

        var mainHeaderDatabin = databinsSaver.getMainHeaderDatabin();

        var sizMarkerOffset = offsetsCalculator.getImageAndTileSizeOffset();
        
        var numComponentsOffset =
            sizMarkerOffset + jGlobals.j2kOffsets.NUM_COMPONENTS_OFFSET_AFTER_SIZ_MARKER;

        var numComponentsBytes = getBytes(
            mainHeaderDatabin,
            /*numBytes=*/2,
            /*startOffset=*/numComponentsOffset);
        var numComponents = messageHeaderParser.getInt16(numComponentsBytes, 0);
        
        var packedPacketHeadersMarkerInTileHeader =
            markersParser.getMarkerOffsetInDatabin(
                databin, jGlobals.j2kMarkers.PackedPacketHeadersInTileHeader);
        
        var packedPacketHeadersMarkerInMainHeader =
            markersParser.getMarkerOffsetInDatabin(
                mainHeaderDatabin, jGlobals.j2kMarkers.PackedPacketHeadersInMainHeader);
        
        var isPacketHeadersNearData =
            packedPacketHeadersMarkerInTileHeader === null &&
            packedPacketHeadersMarkerInMainHeader === null;
        
        var codingStyleMoreDataOffset = baseParams.codingStyleDefaultOffset + 6;
        var codingStyleMoreDataBytes = getBytes(
            databin,
            /*numBytes=*/6,
            /*startOffset=*/codingStyleMoreDataOffset);
        var numQualityLayers = messageHeaderParser.getInt16(
            codingStyleMoreDataBytes, 0);

        var codeblockWidth = parseCodeblockSize(
            codingStyleMoreDataBytes, 4);
        var codeblockHeight = parseCodeblockSize(
            codingStyleMoreDataBytes, 5);
        
        var precinctWidths = new Array(baseParams.numResolutionLevels);
        var precinctHeights = new Array(baseParams.numResolutionLevels);
        
        var precinctSizesBytes = null;
        if (!baseParams.isDefaultPrecinctSize) {
            var precinctSizesBytesNeeded = baseParams.numResolutionLevels;
            
            precinctSizesBytes = getBytes(
                databin,
                precinctSizesBytesNeeded,
                baseParams.precinctSizesOffset);
        }

        var defaultSize = 1 << 15;
        for (var i = 0; i < baseParams.numResolutionLevels; ++i) {
            if (baseParams.isDefaultPrecinctSize) {
                precinctWidths[i] = defaultSize;
                precinctHeights[i] = defaultSize;
                continue;
            }
            
            var precinctSizeOffset = i;
            var sizeExponents = precinctSizesBytes[precinctSizeOffset];
            var ppx = sizeExponents & 0x0F;
            var ppy = sizeExponents >>> 4;
            
            precinctWidths[i] = 1 * Math.pow(2, ppx); // Avoid negative result due to signed calculation
            precinctHeights[i] = 1 * Math.pow(2, ppy); // Avoid negative result due to signed calculation
        }
        
        var paramsPerComponent = new Array(numComponents);
        for (var j = 0; j < numComponents; ++j) {
            paramsPerComponent[j] = {
                maxCodeblockWidth: codeblockWidth,
                maxCodeblockHeight: codeblockHeight,
                
                numResolutionLevels: baseParams.numResolutionLevels,
                
                precinctWidthPerLevel: precinctWidths,
                precinctHeightPerLevel: precinctHeights
            };
        }
        
        var defaultComponentParams = {
            maxCodeblockWidth: codeblockWidth,
            maxCodeblockHeight: codeblockHeight,
            
            numResolutionLevels: baseParams.numResolutionLevels,
            
            precinctWidthPerLevel: precinctWidths,
            precinctHeightPerLevel: precinctHeights
            };
        
        var tileParams = {
            numQualityLayers: numQualityLayers,
            
            isPacketHeadersNearData: isPacketHeadersNearData,
            isStartOfPacketMarkerAllowed: baseParams.isStartOfPacketMarkerAllowed,
            isEndPacketHeaderMarkerAllowed: baseParams.isEndPacketHeaderMarkerAllowed,

            paramsPerComponent: paramsPerComponent,
            defaultComponentParams: defaultComponentParams
            };
        
        return tileParams;
    }
    
    function parseCodeblockSize(bytes, offset) {
        var codeblockSizeExponentMinus2 = bytes[offset];
        var codeblockSizeExponent = 2 + (codeblockSizeExponentMinus2 & 0x0F);
        
        if (codeblockSizeExponent > 10) {
            throw new jGlobals.j2kExceptions.IllegalDataException(
                'Illegal codeblock width exponent ' + codeblockSizeExponent,
                'A.6.1, Table A.18');
        }
        
        var size = 1 << codeblockSizeExponent;
        return size;
    }
    
    function getBytes(databin, numBytes, databinStartOffset, allowEndOfRange) {
        var bytes = [];

        var rangeOptions = {
            forceCopyAllRange: true,
            maxLengthToCopy: numBytes,
            databinStartOffset: databinStartOffset
            };
        
        var bytesCopied = databin.copyBytes(bytes, /*startOffset=*/0, rangeOptions);
        if (bytesCopied === null) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Header data-bin has not yet recieved ' + numBytes +
                ' bytes starting from offset ' + databinStartOffset);
        }
        
        return bytes;
    }
};
},{"j2k-jpip-globals.js":16}],22:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipChannel(
    maxRequestsWaitingForResponseInChannel, sessionHelper, jpipFactory) {
    
    var self = this;
    var channelId = null;
    var requestId = 0;
    var requestsWaitingForChannelCreation = [];
    var requestsWaitingForResponse = [];
    var isDedicatedForMovableRequest = false;
    
    this.requestData = function requestData(
        codestreamPartParams,
        callback,
        failureCallback,
        numQualityLayers) {
        
        if (!isDedicatedForMovableRequest) {
            // No need to check if there are too many concurrent requests
            // if channel was dedicated for movable request. The reason is
            // that any request in dedicated channel cancel the previous one.
            
            var allWaitingRequests = getAllQueuedRequestCount();
            
            if (allWaitingRequests >= maxRequestsWaitingForResponseInChannel) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Channel has too many requests not responded yet');
            }
        }

        var url = createRequestUrl(codestreamPartParams, numQualityLayers);
        var request = jpipFactory.createRequest(
            sessionHelper,
            self,
            url,
            callback,
            failureCallback);
        
        if (channelId !== null || requestsWaitingForResponse.length === 0) {
            requestsWaitingForResponse.push(request);
            request.startRequest();
        } else if (isDedicatedForMovableRequest) {
            // Those requests cancel all previous requests in channel, so no
            // need to log old requests
            requestsWaitingForChannelCreation = [request];
        } else {
            requestsWaitingForChannelCreation.push(request);
        }
        
        return request;
    };
    
    this.sendMinimalRequest = function sendMinimalRequest(callback) {
        if (channelId === null && requestsWaitingForResponse.length > 0) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Minimal requests should be used for first request or keep ' +
                'alive message. Keep alive requires an already initialized ' +
                'channel, and first request requires to not have any ' +
                'previous request');
        }
        
        var url = createMinimalRequestUrl();
        var request = jpipFactory.createRequest(
            sessionHelper, self, url, callback);
        
        requestsWaitingForResponse.push(request);
        request.startRequest();
    };
    
    this.getIsDedicatedForMovableRequest =
        function getIsDedicatedForMovableRequest() {
        
        return isDedicatedForMovableRequest;
    };
    
    this.dedicateForMovableRequest = function dedicateForMovableRequest() {
        if (isDedicatedForMovableRequest) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Channel already dedicated for movable request');
        }
        
        isDedicatedForMovableRequest = true;
    };
    
    this.getChannelId = function getChannelId() {
        return channelId;
    };
    
    this.setChannelId = function setChannelId(newChannelId) {
        if (newChannelId === null) {
            return;
        }
        
        channelId = newChannelId;
        
        var requestsToSend = requestsWaitingForChannelCreation;
        requestsWaitingForChannelCreation = [];
        
        for (var i = 0; i < requestsToSend.length; ++i) {
            requestsWaitingForResponse.push(requestsToSend[i]);
            requestsToSend[i].startRequest();
        }
    };
    
    this.nextRequestId = function nextRequestId() {
        return ++requestId;
    };
    
    this.getRequestsWaitingForResponse =
        function getRequestsWaitingForResponse() {
        
        return requestsWaitingForResponse;
    };
    
    this.getAllQueuedRequestCount = getAllQueuedRequestCount;
    
    this.requestEnded = function requestEnded(ajaxResponse, request) {
        var requests = requestsWaitingForResponse;
        var isFound = false;
        for (var i = 0; i < requests.length; ++i) {
            if (requests[i] === request) {
                requests[i] = requests[requests.length - 1];
                requests.length -= 1;
                isFound = true;
                break;
            }
        }
        
        if (!isFound) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'channel.requestsWaitingForResponse inconsistency');
        }
        
        sessionHelper.requestEnded(ajaxResponse, self);
        
        if (channelId === null && requestsWaitingForChannelCreation.length > 0) {
            // If not succeeded to create a channel ID yet,
            // perform an additional request
            
            var nextRequest = requestsWaitingForChannelCreation.shift();
            
            requestsWaitingForResponse.push(nextRequest);
            nextRequest.startRequest();
        }
    };
    
    this.isAllOldRequestsEnded = function isAllOldRequestsEnded(priorToId) {
        for (var i = 0; i < requestsWaitingForResponse.length; ++i) {
            if (requestsWaitingForResponse[i].lastRequestId <= priorToId) {
                return false;
            }
        }
        
        return true;
    };
    
    function getAllQueuedRequestCount() {
        var allWaitingRequests =
            requestsWaitingForResponse.length +
            requestsWaitingForChannelCreation.length;
        
        return allWaitingRequests;
    }
    
    function createMinimalRequestUrl(allowStopPreviousRequestsInChannel) {
        var requestUrl = sessionHelper.getDataRequestUrl();
        var targetId = sessionHelper.getTargetId();
        
        if (targetId !== '0') {
            requestUrl += '&tid=' + targetId;
        }
        
        var alreadySentMessagesOnChannel = channelId !== null;
        
        if (alreadySentMessagesOnChannel) {
            var isStopPrevious =
                isDedicatedForMovableRequest &&
                allowStopPreviousRequestsInChannel;
            
            if (isStopPrevious) {
                requestUrl += '&wait=no';
            } else {
                requestUrl += '&wait=yes';
            }
        }
        
        return requestUrl;
    }
        
    function createRequestUrl(codestreamPartParams, numQualityLayers) {
        var requestUrl = createMinimalRequestUrl(
            /*allowStopPreviousRequestsInChannel=*/true);
        
        var codestreamStructure = sessionHelper.getCodestreamStructure();
        
        var frameWidth = codestreamStructure.getLevelWidth(
            codestreamPartParams.level);
        var frameHeight = codestreamStructure.getLevelHeight(
            codestreamPartParams.level);
        
        var regionWidth =
            codestreamPartParams.maxXExclusive - codestreamPartParams.minX;
        var regionHeight =
            codestreamPartParams.maxYExclusive - codestreamPartParams.minY;
        
        requestUrl +=
            '&fsiz=' + frameWidth + ',' + frameHeight + ',closest' +
            '&rsiz=' + regionWidth + ',' + regionHeight +
            '&roff=' + codestreamPartParams.minX + ',' + codestreamPartParams.minY;
            
        if (numQualityLayers !== 'max') {
            requestUrl += '&layers=' + numQualityLayers;
        }
        
        return requestUrl;
    }
};
},{"j2k-jpip-globals.js":16}],23:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

var jpipMessageHeaderParser = {
        
    LSB_MASK: 0x1,
    BIT_4_MASK: 0x10,
    BITS_56_MASK: 0x60,
    MSB_MASK: 0x80,

    LSB_7_MASK: 0x7F,

    // A.2.1
    parseNumberInVbas: function parseNumberInVbasClosure(
        message, startOffset, bitsToTakeInFirstByte) {
        
        var self = jpipMessageHeaderParser;
        var currentOffset = startOffset;
        
        var result;
        if (bitsToTakeInFirstByte) {
            var maskFirstByte = (1 << bitsToTakeInFirstByte) - 1;
            result = message[currentOffset] & maskFirstByte;
        }
        else {
            result = message[currentOffset] & self.LSB_7_MASK;
        }
        
        while ( !!(message[currentOffset] & self.MSB_MASK) ) {
            ++currentOffset;

            result <<= 7;
            result |= message[currentOffset] & self.LSB_7_MASK;
        }
        
        return {
            endOffset: currentOffset + 1,
            number: result
        };
    },
    
    // A.2
    parseMessageHeader: function parseMessageHeaderClosure(
        message, startOffset, previousMessageHeader) {
        
        var self = jpipMessageHeaderParser;
        
        // A.2.1
        
        // First Vbas: Bin-ID
        
        var classAndCsnPrecense = (message[startOffset] & self.BITS_56_MASK) >>> 5;
        
        if (classAndCsnPrecense === 0) {
            throw new jGlobals.jpipExceptions.ParseException('Failed parsing message header ' +
                '(A.2.1): prohibited existance class and csn bits 00');
        }
        
        var hasClassVbas = !!(classAndCsnPrecense & 0x2);
        var hasCodeStreamIndexVbas = classAndCsnPrecense === 3;
        
        var isLastByteInDatabin = !!(message[startOffset] & self.BIT_4_MASK);
        
        // A.2.3
        var parsedInClassId = self.parseNumberInVbas(
            message, startOffset, /*bitsToTakeInFirstByte=*/4);
        var inClassId = parsedInClassId.number;
        var currentOffset = parsedInClassId.endOffset;
        
        // Second optional Vbas: Class ID
        
        var classId = 0;
        if (hasClassVbas) {
            var parsedClassId = self.parseNumberInVbas(message, currentOffset);
            classId = parsedClassId.number;
            currentOffset = parsedClassId.endOffset;
        }
        else if (previousMessageHeader) {
            classId = previousMessageHeader.classId;
        }
        
        // Third optional Vbas: Code Stream Index (Csn)
        
        var codestreamIndex = 0;
        if (hasCodeStreamIndexVbas) {
            var parsedCsn = self.parseNumberInVbas(message, currentOffset);
            codestreamIndex = parsedCsn.number;
            currentOffset = parsedCsn.endOffset;
        }
        else if (previousMessageHeader) {
            codestreamIndex = previousMessageHeader.codestreamIndex;
        }
        
        // 4th Vbas: Message offset
        
        var parsedOffset = self.parseNumberInVbas(message, currentOffset);
        var messageOffsetFromDatabinStart = parsedOffset.number;
        currentOffset = parsedOffset.endOffset;
        
        // 5th Vbas: Message length

        var parsedLength = self.parseNumberInVbas(message, currentOffset);
        var messageBodyLength = parsedLength.number;
        currentOffset = parsedLength.endOffset;
        
        // 6th optional Vbas: Aux
        
        // A.2.2
        var hasAuxVbas = !!(classId & self.LSB_MASK);
        
        var aux;
        if (hasAuxVbas) {
            var parsedAux = self.parseNumberInVbas(message, currentOffset);
            aux = parsedAux.number;
            currentOffset = parsedAux.endOffset;
        }
        
        // Return
        
        var result = {
            isLastByteInDatabin: isLastByteInDatabin,
            inClassId: inClassId,
            bodyStart: currentOffset,
            classId: classId,
            codestreamIndex: codestreamIndex,
            messageOffsetFromDatabinStart: messageOffsetFromDatabinStart,
            messageBodyLength: messageBodyLength
        };
        
        if (hasAuxVbas) {
            result.aux = aux;
        }
        
        return result;
    },
    
    getInt32: function getInt32Closure(data, offset) {
        var msb = data[offset] * Math.pow(2, 24); // Avoid negative result due to signed calculation
        var byte2 = data[offset + 1] << 16;
        var byte1 = data[offset + 2] << 8;
        var lsb = data[offset + 3];
        
        var result = msb + byte2 + byte1 + lsb;
        return result;
    },
    
    getInt16: function getInt16Closure(data, offset) {
        var msb = data[offset] << 8;
        var lsb = data[offset + 1];
        
        var result = msb + lsb;
        return result;
    }
};

module.exports = jpipMessageHeaderParser;
},{"j2k-jpip-globals.js":16}],24:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipReconnectableRequester(
    maxChannelsInSession,
    maxRequestsWaitingForResponseInChannel, 
    codestreamStructure,
    databinsSaver,
    jpipFactory,
    // NOTE: Move parameter to beginning and expose in CodestreamClient
    maxJpipCacheSizeConfig) {
    
    var MB = 1048576;
    var maxJpipCacheSize = maxJpipCacheSizeConfig || (10 * MB);
    
    var sessionWaitingForReady;
    var activeSession = null;
    var sessionWaitingForDisconnect = null;
    
    var url = null;
    var waitingForCloseSessions = 0;
    
    var nonDedicatedRequestsWaitingForSend = [];
    var dedicatedChannels = [];
    
    var statusCallback = null;
    var lastClosedCallback = null;
    
    this.getIsReady = function getIsReady() {
        return activeSession !== null && activeSession.getIsReady();
    };
    
    this.open = function open(baseUrl) {
        if (baseUrl === undefined || baseUrl === null) {
            throw new jGlobals.jpipExceptions.ArgumentException('baseUrl', baseUrl);
        }
        
        if (url !== null) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Image was already opened');
        }
        
        url = baseUrl;
        createInternalSession();
    };
    
    this.close = function close(closedCallback) {
        if (lastClosedCallback !== null) {
            throw new jGlobals.jpipExceptions.IllegalOperationException('closed twice');
        }
        
        lastClosedCallback = closedCallback;
        waitingForCloseSessions = 1;
        
        closeInternalSession(activeSession);
        closeInternalSession(sessionWaitingForReady);
        closeInternalSession(sessionWaitingForDisconnect);
        
        checkIfAllSessionsClosedAfterSessionClosed();
    };

    this.setStatusCallback = function setStatusCallback(newStatusCallback) {
        statusCallback = newStatusCallback;
        
        if (activeSession !== null) {
            activeSession.setStatusCallback(newStatusCallback);
        }
    };
    
    this.dedicateChannelForMovableRequest =
        function dedicateChannelForMovableRequest() {

        checkReady();
        
        var dedicatedChannelHandle = { internalDedicatedChannel: null };
        dedicatedChannels.push(dedicatedChannelHandle);
        createInternalDedicatedChannel(dedicatedChannelHandle);
        
        return dedicatedChannelHandle;
    };
    
    this.requestData = function requestData(
        codestreamPartParams,
        callback,
        failureCallback,
        numQualityLayers,
        dedicatedChannelHandleToMove) {

        checkReady();
        
        var request = {
            isEnded: false,
            internalRequest: null,
            
            codestreamPartParams: codestreamPartParams,
            callback: callback,
            failureCallback: failureCallback,
            numQualityLayers: numQualityLayers
            };
        
        var channel;
        var moveDedicatedChannel = !!dedicatedChannelHandleToMove;
        
        if (moveDedicatedChannel) {
            channel = dedicatedChannelHandleToMove.internalDedicatedChannel;
        } else {
            channel = activeSession.tryGetChannel();
            
            if (channel === null) {
                nonDedicatedRequestsWaitingForSend.push(request);
                return request;
            } else if (channel.getIsDedicatedForMovableRequest()) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Expected non-movable channel');
            }
        }
        
        if (channel.getIsDedicatedForMovableRequest() !== moveDedicatedChannel) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'getIsDedicatedForMovableRequest inconsistency');
        }

        request.internalRequest = channel.requestData(
            codestreamPartParams,
            callback,
            failureCallback,
            numQualityLayers);

        return request;
    };
    
    this.stopRequestAsync = function stopRequestAsync(request) {
        request.isEnded = true;
        
        if (request.internalRequest !== null) {
            request.internalRequest.stopRequestAsync();
        }
    };
    
    this.reconnect = reconnect;
    
    function reconnect() {
        if (sessionWaitingForReady !== null) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Previous session still not established');
        }
        
        if (sessionWaitingForDisconnect !== null) {
            if (statusCallback !== null) {
                statusCallback({
                    isReady: true,
                    exception: //jpipExceptions.IllegalOperationException(
                        'Previous session that should be closed still alive.' +
                        'Maybe old requestContexts have not beed closed. ' +
                        'Reconnect will not be done' //);
                    });
            }
            
            return;
        }
        
        databinsSaver.cleanupUnregisteredDatabins();
        createInternalSession();
    }
    
    function createInternalSession() {
        var targetId;
        if (activeSession !== null) {
            targetId = activeSession.getTargetId();
        }
        
        sessionWaitingForReady = jpipFactory.createSession(
            maxChannelsInSession,
            maxRequestsWaitingForResponseInChannel,
            targetId,
            codestreamStructure,
            databinsSaver);
            
        sessionWaitingForReady.setStatusCallback(waitingForReadyCallback);
        
        sessionWaitingForReady.open(url);
    }
    
    function createInternalDedicatedChannel(dedicatedChannelHandle) {
        var channel = activeSession.tryGetChannel(
            /*dedicateForMovableRequest=*/true);
        
        if (channel === null) {
            throw new jGlobals.jpipExceptions.IllegalOperationException(
                'Too many concurrent requests. Limit the use of dedicated ' +
                '(movable) requests, enlarge maxChannelsInSession or wait ' +
                'for requests to finish and avoid create new ones');
        }
        
        if (!channel.getIsDedicatedForMovableRequest()) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'getIsDedicatedForMovableRequest inconsistency');
        }

        dedicatedChannelHandle.internalDedicatedChannel = channel;
    }
    
    function waitingForReadyCallback(status) {
        if (sessionWaitingForReady === null ||
            status.isReady !== sessionWaitingForReady.getIsReady()) {
            
            throw new jGlobals.jpipExceptions.InternalErrorException('Unexpected ' +
                'statusCallback when not registered to session or ' +
                'inconsistent isReady');
        }
        
        if (status.isReady) {
            if (sessionWaitingForDisconnect !== null) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'sessionWaitingForDisconnect should be null');
            }
            
            sessionWaitingForDisconnect = activeSession;
            activeSession = sessionWaitingForReady;
            sessionWaitingForReady = null;
            
            if (sessionWaitingForDisconnect !== null) {
                sessionWaitingForDisconnect.setStatusCallback(null);
                if (!tryDisconnectWaitingSession()) {
                    sessionWaitingForDisconnect.setRequestEndedCallback(
                        tryDisconnectWaitingSession);
                }
            }
            
            activeSession.setStatusCallback(statusCallback);
            activeSession.setRequestEndedCallback(activeSessionRequestEndedCallback);
            
            for (var i = 0; i < dedicatedChannels.length; ++i) {
                createInternalDedicatedChannel(dedicatedChannels[i]);
            }
        }
        
        if (statusCallback !== null) {
            statusCallback(status);
        }
    }
    
    function closeInternalSession(session) {
        if (session !== null) {
            ++waitingForCloseSessions;
            session.close(checkIfAllSessionsClosedAfterSessionClosed);
        }
    }
    
    function checkIfAllSessionsClosedAfterSessionClosed() {
        --waitingForCloseSessions;
        
        if (waitingForCloseSessions === 0 && lastClosedCallback !== undefined) {
            lastClosedCallback();
        }
    }
    
    function checkReady() {
        if (activeSession === null) {
            throw new jGlobals.jpipExceptions.InternalErrorException('This operation ' +
                'is forbidden when session is not ready');
        }
    }
    
    function activeSessionRequestEndedCallback(channelFreed) {
        var request = null;
        
        if (databinsSaver.getLoadedBytes() > maxJpipCacheSize) {
            reconnect();
        }
        
        if (channelFreed === null) {
            return;
        }
        
        if (channelFreed.getIsDedicatedForMovableRequest()) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Expected non-movable channel as channelFreed');
        }
        
        do {
            if (nonDedicatedRequestsWaitingForSend.length === 0) {
                request = null;
                break;
            }
            
            request = nonDedicatedRequestsWaitingForSend.shift();
            if (request.internalRequest !== null) {
                throw new jGlobals.jpipExceptions.InternalErrorException('Request was ' +
                    'already sent but still in queue');
            }
        } while (request.isEnded);
        
        if (request !== null) {
            request.internalRequest = channelFreed.requestData(
                request.codestreamPartParams,
                request.callback,
                request.failureCallback,
                request.numQualityLayers);
        }
    }
    
    function tryDisconnectWaitingSession() {
        var canCloseSession = !sessionWaitingForDisconnect.hasActiveRequests();
        
        if (canCloseSession) {
            sessionWaitingForDisconnect.close();
            sessionWaitingForDisconnect = null;
        }
        
        return canCloseSession;
    }
};
},{"j2k-jpip-globals.js":16}],25:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipRequest(
    sessionHelper,
    messageHeaderParser,
    channel,
    requestUrl,
    callback,
    failureCallback) {
    
    var KB = 1024;
    var PROGRESSIVENESS_MIN_LENGTH_BYTES = 10 * KB;

    var RESPONSE_ENDED_SUCCESS = 1;
    var RESPONSE_ENDED_ABORTED = 2;
    var RESPONSE_ENDED_SENT_ANOTHER_MESSAGE = 3;
    
    var self = this;
    var isActive = false;
    var endedByUser = false;
    var lastRequestId;
    var responseLength = PROGRESSIVENESS_MIN_LENGTH_BYTES;
    
    this.startRequest = function startRequest() {
        if (isActive) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'startRequest called twice');
        } else if (endedByUser) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'request was already stopped');
        }
        
        isActive = true;
        sessionHelper.requestStarted();
        
        sendMessageOfDataRequest();
    };

    this.stopRequestAsync = function stopRequestAsync(request) {
        endedByUser = true;
    };
    
    this.getLastRequestId = function getLastRequestId() {
        if (!isActive) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Unexpected call to getLastRequestId on inactive request');
        }
        
        return lastRequestId;
    };
    
    this.callCallbackAfterConcurrentRequestsFinished =
        function callCallbackAfterConcurrentRequestsFinished() {
        
        callback(self, /*isResponseDone=*/true);
    };
    
    function internalSuccessCallback(ajaxResponse, isResponseDone) {
        var failed = false;

        try {
            var endedReason = processAjaxResponse(ajaxResponse, isResponseDone);
            
            if (endedReason === RESPONSE_ENDED_SENT_ANOTHER_MESSAGE) {
                return;
            }
            
            failed = endedReason === RESPONSE_ENDED_ABORTED;
        } catch (e) {
            failed = true;
            sessionHelper.onException(e);
        }
        
        try {
            if (!failed) {
                sessionHelper.waitForConcurrentRequestsToEnd(self);
            }
            
            channel.requestEnded(ajaxResponse, self);

            if (failed && !endedByUser && failureCallback !== undefined) {
                failureCallback();
            }
            
            sessionHelper.checkConcurrentRequestsFinished();
        } catch (e) {
            sessionHelper.onException(e);
        }
    }
    
    function internalFailureCallback(ajaxResponse) {
        channel.requestEnded(ajaxResponse, self);
        sessionHelper.checkConcurrentRequestsFinished();
        
        if (failureCallback !== undefined) {
            failureCallback();
        }
    }
    
    function processAjaxResponse(ajaxResponse, isResponseDone) {
        if (!isResponseDone) {
            throw new jGlobals.jpipExceptions.InternalErrorException('AJAX ' +
                'callback called although response is not done yet ' +
                'and chunked encoding is not enabled');
        }
                
        var createdChannel = sessionHelper.getCreatedChannelId(
            ajaxResponse);
        
        if (createdChannel !== null) {
            if (channel.getChannelId() !== null) {
                sessionHelper.onException(
                    new jGlobals.jpipExceptions.IllegalDataException(
                        'Channel created although was not requested', 'D.2.3'));
            } else {
                channel.setChannelId(createdChannel);
            }
        } else if (channel.getChannelId() === null) {
            sessionHelper.onException(
                new jGlobals.jpipExceptions.IllegalDataException(
                    'Cannot extract cid from cnew response', 'D.2.3'));
        }
        
        var endOffset = saveToDatabinsFromOffset(ajaxResponse);
        
        if (endOffset === null) {
            return RESPONSE_ENDED_ABORTED;
        }
        
        var endedReason = parseEndOfResponse(ajaxResponse, endOffset);
        return endedReason;
    }
    
    function sendMessageOfDataRequest() {
        lastRequestId = channel.nextRequestId();
        
        var url = requestUrl +
            '&len=' + responseLength +
            '&qid=' + lastRequestId;
        
        responseLength *= 2;
        
        var shouldCreateChannel = channel.getChannelId() === null;
        if (shouldCreateChannel) {
            url += '&cnew=http';
            
            var existChannelInSession = sessionHelper.getFirstChannel();
                
            if (existChannelInSession !== null) {
                url += '&cid=' + existChannelInSession.getChannelId();
            }
            
            // NOTE: If existChannelInSession, maybe should remove "&stream=0"
        } else {
            url += '&cid=' + channel.getChannelId();
        }
        
        sessionHelper.sendAjax(
            url,
            internalSuccessCallback,
            internalFailureCallback);
    }
    
    function parseEndOfResponse(ajaxResponse, offset) {
        var endResponseResult = RESPONSE_ENDED_ABORTED;
        var bytes = new Uint8Array(ajaxResponse.response);
        
        if (offset > bytes.length - 2 ||
            bytes[offset] !== 0) {
            
            throw new jGlobals.jpipExceptions.IllegalDataException('Could not find ' +
                'End Of Response (EOR) code at the end of response', 'D.3');
        }
        
        switch (bytes[offset + 1]) {
            case jGlobals.jpipEndOfResponseReasons.IMAGE_DONE:
            case jGlobals.jpipEndOfResponseReasons.WINDOW_DONE:
            case jGlobals.jpipEndOfResponseReasons.QUALITY_LIMIT:
                endResponseResult = RESPONSE_ENDED_SUCCESS;
                break;
            
            case jGlobals.jpipEndOfResponseReasons.WINDOW_CHANGE:
                if (!endedByUser) {
                    throw new jGlobals.jpipExceptions.IllegalOperationException(
                        'Server response was terminated due to newer ' +
                        'request issued on same channel. That may be an ' +
                        'internal webjpip.js error - Check that movable ' +
                        'requests are well maintained');
                }
                break;
            
            case jGlobals.jpipEndOfResponseReasons.BYTE_LIMIT:
            case jGlobals.jpipEndOfResponseReasons.RESPONSE_LIMIT:
                if (!endedByUser) {
                    sendMessageOfDataRequest();
                    endResponseResult = RESPONSE_ENDED_SENT_ANOTHER_MESSAGE;
                }
                
                break;
            
            case jGlobals.jpipEndOfResponseReasons.SESSION_LIMIT:
                sessionHelper.onException(
                    new jGlobals.jpipExceptions.IllegalOperationException(
                        'Server resources associated with the session is ' +
                        'limitted, no further requests should be issued to ' +
                        'this session'));
                break;
            
            case jGlobals.jpipEndOfResponseReasons.NON_SPECIFIED:
                sessionHelper.onException(new jGlobals.jpipExceptions.IllegalOperationException(
                    'Server error terminated response with no reason specified'));
                break;
                    
            default:
                sessionHelper.onException(
                    new jGlobals.jpipExceptions.IllegalDataException(
                        'Server responded with illegal End Of Response ' +
                        '(EOR) code: ' + bytes[offset + 1]));
                break;
        }
        
        return endResponseResult;
    }
    
    function saveToDatabinsFromOffset(ajaxResponse) {
        try {
            var bytes = new Uint8Array(ajaxResponse.response);
            
            var offset = 0;
            var previousHeader;
            
            while (offset < bytes.length) {
                if (bytes[offset] === 0) {
                    // End Of Response (EOR)
                    break;
                }
                
                var header = messageHeaderParser.parseMessageHeader(
                    bytes, offset, previousHeader);
                
                if (header.bodyStart + header.messageBodyLength > bytes.length) {
                    return offset;
                }
                
                sessionHelper.getDatabinsSaver().saveData(header, bytes);
                
                offset = header.bodyStart + header.messageBodyLength;
                previousHeader = header;
            }
            
            return offset;
        } catch (e) {
            sessionHelper.onException(e);
            
            return null;
        }
    }
};
},{"j2k-jpip-globals.js":16}],26:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipSessionHelper(
    dataRequestUrl,
    knownTargetId,
    codestreamStructure,
    databinsSaver,
    ajaxHelper) {
    
    var statusCallback = null;
    var requestEndedCallback = null;
    
    var channels = [];
    var firstChannel = null;

    var activeRequests = 0;
    var waitingForConcurrentRequests = [];

    var isReady = false;
    var targetId = knownTargetId || '0';
    
    this.onException = function onException(exception) {
        onStatusChange(exception);
    };
    
    this.getIsReady = function getIsReady() {
        return isReady;
    };
    
    this.setIsReady = function setIsReady(isReady_) {
        isReady = isReady_;
        onStatusChange();
    };
    
    this.getCodestreamStructure = function getCodestreamStructure() {
        return codestreamStructure;
    };
    
    this.getDatabinsSaver = function getDatabinsSaver() {
        return databinsSaver;
    };
    
    this.getDataRequestUrl = function getDataRequestUrl() {
        return dataRequestUrl;
    };
    
    this.getTargetId = function getTargetId() {
        return targetId;
    };
    
    this.getFirstChannel = function getFirstChannel() {
        return firstChannel;
    };
    
    this.setStatusCallback = function setStatusCallback(statusCallback_) {
        statusCallback = statusCallback_;
    };
    
    this.setRequestEndedCallback = function setRequestEndedCallback(
        requestEndedCallback_) {
        
        requestEndedCallback = requestEndedCallback_;
    };
    
    this.requestStarted = function requestStarted() {
        ++activeRequests;
    };
    
    this.requestEnded = function requestEnded(ajaxResponse, channel) {
        --activeRequests;
        
        var targetIdFromServer = ajaxResponse.getResponseHeader('JPIP-tid');
        if (targetIdFromServer !== '' && targetIdFromServer !== null) {
            if (targetId === '0') {
                targetId = targetIdFromServer;
            } else if (targetId !== targetIdFromServer) {
                throw new jGlobals.jpipExceptions.IllegalDataException(
                    'Server returned unmatched target ID');
            }
        }
        
        if (firstChannel === null) {
            firstChannel = channel;
        }
        
        var channelFreed = channel.getIsDedicatedForMovableRequest() ?
            null : channel;
        
        if (requestEndedCallback !== null) {
            requestEndedCallback(channelFreed);
        }
    };
    
    this.getActiveRequestsCount = function getActiveRequestsCount() {
        return activeRequests;
    };
    
    this.channelCreated = function channelCreated(channel) {
        channels.push(channel);
    };
    
    this.getCreatedChannelId = function getCreatedChannelId(ajaxResponse) {
        var cnewResponse = ajaxResponse.getResponseHeader('JPIP-cnew');
        if (!cnewResponse) {
            return null;
        }
        
        var keyValuePairsInResponse = cnewResponse.split(',');

        for (var i = 0; i < keyValuePairsInResponse.length; ++i) {
            var keyAndValue = keyValuePairsInResponse[i].split('=');

            if (keyAndValue[0] === 'cid') {
                return keyAndValue[1];
            }
        }
        
        return null;
    };
    
    this.waitForConcurrentRequestsToEnd =
        function waitForConcurrentRequestsToEnd(request) {
        
        var concurrentRequests = [];
        
        for (var i = 0; i < channels.length; ++i) {
            var requests = channels[i].getRequestsWaitingForResponse();
            var numRequests = requests.length;
            if (numRequests === 0) {
                continue;
            }
            
            var lastRequestId = requests[0].getLastRequestId();
            for (var j = 1; j < requests.length; ++j) {
                lastRequestId = Math.max(
                    lastRequestId, requests[j].getLastRequestId());
            }
            
            concurrentRequests.push({
                channel: channels[i],
                requestId: lastRequestId
                });
        }
        
        waitingForConcurrentRequests.push({
            request: request,
            concurrentRequests: concurrentRequests
            });
    };

    this.checkConcurrentRequestsFinished =
        function checkConcurrentRequestsFinished() {
        
        for (var i = waitingForConcurrentRequests.length - 1; i >= 0; --i) {
            var isAllConcurrentRequestsFinished = false;
            var concurrentRequests =
                waitingForConcurrentRequests[i].concurrentRequests;
            
            for (var j = concurrentRequests.length - 1; j >= 0; --j) {
                var waiting = concurrentRequests[j];
                
                if (waiting.channel.isAllOldRequestsEnded(waiting.requestId)) {
                    concurrentRequests[j] = concurrentRequests[
                        concurrentRequests.length - 1];
                    concurrentRequests.length -= 1;
                }
            }
            
            if (concurrentRequests.length > 0) {
                continue;
            }
            
            var request = waitingForConcurrentRequests[i].request;
            var callback = request.callback;
            
            waitingForConcurrentRequests[i] = waitingForConcurrentRequests[
                waitingForConcurrentRequests.length - 1];
            waitingForConcurrentRequests.length -= 1;
            
            request.callCallbackAfterConcurrentRequestsFinished();
        }
    };
    
    this.sendAjax = function sendAjax(
        url,
        callback,
        failureCallback) {
        
        var forkedFailureCallback;
        
        if (failureCallback) {
            forkedFailureCallback = function forkFailureCallback(ajaxResponse) {
                generalFailureCallback(ajaxResponse);
                failureCallback(ajaxResponse);
            };
        } else {
            forkedFailureCallback = generalFailureCallback;
        }
        
        ajaxHelper.request(url, callback, forkedFailureCallback);
    };
    
    function generalFailureCallback(ajaxResponse) {
        var exception = new jGlobals.jpipExceptions.InternalErrorException(
            'Bad jpip server response (status = ' + ajaxResponse.status + ')');
            
        onStatusChange(exception);
    }
    
    function onStatusChange(exception) {
        if (exception === undefined) {
            exception = null;
        }
        
        if (statusCallback !== null) {
            statusCallback({
                isReady: isReady,
                exception: exception
            });
        }
    }
};
},{"j2k-jpip-globals.js":16}],27:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipSession(
    maxChannelsInSession,
    maxRequestsWaitingForResponseInChannel,
    knownTargetId,
    codestreamStructure,
    databinsSaver,
    setIntervalFunction,
    clearIntervalFunction,
    jpipFactory) {

    var SECOND = 1000;
    var KEEP_ALIVE_INTERVAL = 30 * SECOND;
    
    var channelManagementUrl;
    var dataRequestUrl;
    var closeSessionUrl;
    
    var isCloseCalled = false;
    var closeCallbackPending = null;

    var sessionHelper = null;
    var statusCallback = null;
    var requestEndedCallback = null;

    var nonDedicatedChannels = [];
    var channelsCreated = 0;
    var keepAliveIntervalHandle = null;
    
    this.open = function open(baseUrl) {
        if (sessionHelper !== null) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'session.open() should be called only once');
        }
        
        var queryParamsDelimiter = baseUrl.indexOf('?') < 0 ? '?' : '&';
        channelManagementUrl = baseUrl + queryParamsDelimiter + 'type=' + 
            (databinsSaver.getIsJpipTilePartStream() ? 'jpt-stream' : 'jpp-stream');
        dataRequestUrl = channelManagementUrl + '&stream=0';
        
        sessionHelper = jpipFactory.createSessionHelper(
            dataRequestUrl, knownTargetId, codestreamStructure, databinsSaver);
        
        if (statusCallback !== null) {
            sessionHelper.setStatusCallback(statusCallback);
        }
        
        if (requestEndedCallback !== null) {
            sessionHelper.setRequestEndedCallback(requestEndedCallback);
        }
        
        var channel = createChannel();
        
        channel.sendMinimalRequest(sessionReadyCallback);
    };
    
    this.getTargetId = function getTargetId() {
        ensureReady();
        return sessionHelper.getTargetId();
    };
    
    this.getIsReady = function getIsReady() {
        var isReady = sessionHelper !== null && sessionHelper.getIsReady();
        return isReady;
    };
    
    this.setStatusCallback = function setStatusCallback(statusCallback_) {
        statusCallback = statusCallback_;
        
        if (sessionHelper !== null) {
            sessionHelper.setStatusCallback(statusCallback_);
        }
    };
    
    this.setRequestEndedCallback = function setRequestEndedCallback(
        requestEndedCallback_) {
        
        requestEndedCallback = requestEndedCallback_;
        
        if (sessionHelper !== null) {
            sessionHelper.setRequestEndedCallback(requestEndedCallback_);
        }
    };
    
    this.hasActiveRequests = function hasActiveRequests() {
        ensureReady();

        var isActiveRequests = sessionHelper.getActiveRequestsCount() > 0;
        return isActiveRequests;
    };
    
    this.tryGetChannel = function tryGetChannel(dedicateForMovableRequest) {
        ensureReady();
        
        var canCreateNewChannel = channelsCreated < maxChannelsInSession;
        var searchOnlyChannelWithEmptyQueue =
            canCreateNewChannel || dedicateForMovableRequest;
        
        var maxRequestsInChannel = searchOnlyChannelWithEmptyQueue ?
            0 : maxRequestsWaitingForResponseInChannel - 1;

        var channel = getChannelWithMinimalWaitingRequests(
            maxRequestsInChannel,
            /*isExtractFromNonDedicatedList=*/dedicateForMovableRequest);
        
        if (channel === null && canCreateNewChannel) {
            channel = createChannel(dedicateForMovableRequest);
        }
        
        if (dedicateForMovableRequest && channel !== null) {
            channel.dedicateForMovableRequest();
        }
        
        return channel;
    };
    
    this.close = function close(closedCallback) {
        if (channelsCreated === 0) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Cannot close session before open');
        }

        if (isCloseCalled) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Cannot close session twice');
        }
        
        isCloseCalled = true;
        closeCallbackPending = closedCallback;
        
        if (closeSessionUrl !== undefined) {
            closeInternal();
        }
    };
    
    function closeInternal() {
        if (keepAliveIntervalHandle !== null) {
            clearIntervalFunction(keepAliveIntervalHandle);
        }
        
        sessionHelper.setIsReady(false);
        sessionHelper.sendAjax(closeSessionUrl, closeCallbackPending);
    }
    
    function createChannel(isDedicatedForMovableRequest) {
        ++channelsCreated;
        var channel = jpipFactory.createChannel(
            maxRequestsWaitingForResponseInChannel, sessionHelper);
        
        sessionHelper.channelCreated(channel);
        
        if (!isDedicatedForMovableRequest) {
            nonDedicatedChannels.push(channel);
        }

        return channel;
    }
    
    function getChannelWithMinimalWaitingRequests(
        maxRequestsInChannel, isExtractFromNonDedicatedList) {
        
        var channel = null;
        var index;
        var minimalWaitingRequests = maxRequestsInChannel + 1;
        
        for (var i = 0; i < nonDedicatedChannels.length; ++i) {
            var waitingRequests =
                nonDedicatedChannels[i].getAllQueuedRequestCount();
            
            if (waitingRequests < minimalWaitingRequests) {
                channel = nonDedicatedChannels[i];
                index = i;
                minimalWaitingRequests = waitingRequests;
            }
            
            if (waitingRequests === 0) {
                break;
            }
        }
        
        if (!isExtractFromNonDedicatedList || channel === null) {
            return channel;
        }
        
        nonDedicatedChannels[index] =
            nonDedicatedChannels[nonDedicatedChannels.length - 1];
        nonDedicatedChannels.length -= 1;
        
        return channel;
    }
    
    function sessionReadyCallback() {
        var mainHeaderDatabin = databinsSaver.getMainHeaderDatabin();
        if (!mainHeaderDatabin.isAllDatabinLoaded()) {
            throw new jGlobals.jpipExceptions.IllegalDataException(
                'Main header was not loaded on session creation');
        }
        
        var arbitraryChannel = sessionHelper.getFirstChannel();
        var arbitraryChannelId = arbitraryChannel.getChannelId();
        closeSessionUrl = channelManagementUrl +
            '&cclose=*' +
            '&cid=' + arbitraryChannelId;
        
        if (isCloseCalled) {
            closeInternal();
            return;
        }
        
        if (arbitraryChannelId === null) {
            return; // Failure indication already returned in JpipRequest
        }
        
        keepAliveIntervalHandle = setIntervalFunction(
            keepAliveHandler, KEEP_ALIVE_INTERVAL);
        
        sessionHelper.setIsReady(true);
    }
    
    function keepAliveHandler() {
        if (sessionHelper.getActiveRequestsCount() > 0) {
            return;
        }
        
        var arbitraryChannel = sessionHelper.getFirstChannel();
        arbitraryChannel.sendMinimalRequest(function dummyCallback() {});
    }
    
    function ensureReady() {
        if (sessionHelper === null || !sessionHelper.getIsReady()) {
            throw new jGlobals.jpipExceptions.InternalErrorException('Cannot perform ' +
                'this operation when the session is not ready');
        }
    }
};
},{"j2k-jpip-globals.js":16}],28:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = (function JpipBitstreamReaderClosure() {
    var zeroBitsUntilFirstOneBitMap = createZeroBitsUntilFirstOneBitMap();

    function JpipBitstreamReader(databin, transactionHelper) {
        var initialState = {
            nextOffsetToParse: 0,
            validBitsInCurrentByte: 0,
            originalByteWithoutShift: null,
            currentByte: null,
            isSkipNextByte: false
            };

        var streamState = transactionHelper.createTransactionalObject(initialState);
        var activeTransaction = null;
        
        Object.defineProperty(this, 'activeTransaction', {
            get: function getActiveTransaction() {
                if (activeTransaction === null ||
                    !activeTransaction.isActive) {
                    throw new jGlobals.jpipExceptions.InternalErrorException(
                        'No active transaction in bitstreamReader');
                }
                
                return activeTransaction;
            }
        });
        
        Object.defineProperty(this, 'bitsCounter', {
            get: function getBitsCounter() {
                var state = streamState.getValue(activeTransaction);
                
                tryValidateCurrentByte(databin, state);
                if (state.isSkipNextByte) {
                    throw new jGlobals.jpipExceptions.InternalErrorException(
                        'Unexpected state of bitstreamReader: ' +
                        'When 0xFF encountered, tryValidateCurrentByte ' +
                        'should skip the whole byte  after ' +
                        'shiftRemainingBitsInByte and clear isSkipNextByte. ' +
                        'However the flag is still set');
                }
                
                var result = state.nextOffsetToParse * 8 - state.validBitsInCurrentByte;
                
                return result;
            }
        });
        
        Object.defineProperty(this, 'databinOffset', {
            get: function getDatabinOffset() {
                var state = streamState.getValue(activeTransaction);
                
                if (state.isSkipNextByte) {
                    return state.nextOffsetToParse + 1;
                }
                
                if (state.validBitsInCurrentByte % 8 !== 0 ||
                    state.originalByteWithoutShift === 0xFF) {
                    
                    throw new jGlobals.jpipExceptions.InternalErrorException(
                        'Cannot calculate databin offset when bitstreamReader ' +
                        ' is in the middle of the byte');
                }
                
                return state.nextOffsetToParse - state.validBitsInCurrentByte / 8;
            },
            
            set: function setDatabinOffset(offsetInBytes) {
                var state = streamState.getValue(activeTransaction);
                state.validBitsInCurrentByte = 0;
                state.isSkipNextByte = false;
                state.originalByteWithoutShift = null;
                state.nextOffsetToParse = offsetInBytes;
            }
        });
        
        this.startNewTransaction = function startNewTransaction() {
            if (activeTransaction !== null && activeTransaction.isActive) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Cannot start new transaction in bitstreamReader ' +
                    'while another transaction is active');
            }
            
            activeTransaction = transactionHelper.createTransaction();
        };
        
        this.shiftRemainingBitsInByte = function shiftRemainingBitsInByte() {
            var state = streamState.getValue(activeTransaction);

            state.isSkipNextByte = state.originalByteWithoutShift === 0xFF;
            state.validBitsInCurrentByte = Math.floor(
                state.validBitsInCurrentByte / 8);
        };
        
        this.shiftBit = function shiftBit() {
            var state = streamState.getValue(activeTransaction);
            if (!tryValidateCurrentByte(databin, state)) {
                return null;
            }
            
            var onesCount = countAndShiftBits(
                databin,
                state,
                /*isUntilZeroBit=*/true,
                /*maxBitsToShift=*/1);
            
            return onesCount;
        };
        
        this.countZerosAndShiftUntilFirstOneBit =
            function countZerosAndShiftUntilFirstOneBit(maxBitsToShift) {
                var state = streamState.getValue(activeTransaction);
                var result = countAndShiftBits(
                    databin, state, /*isUntilZeroBit=*/false, maxBitsToShift);
                return result;
        };
        
        this.countOnesAndShiftUntilFirstZeroBit =
            function countOnesAndShiftUntilFirstZeroBit(maxBitsToShift) {
                var state = streamState.getValue(activeTransaction);
                var result = countAndShiftBits(
                    databin, state, /*isUntilZeroBit=*/true, maxBitsToShift);
                return result;
        };
        
        this.shiftBits = function shiftBits(bitsCount) {
            var result = 0;
            var state = streamState.getValue(activeTransaction);
            var remainingBits = bitsCount;
            
            while (remainingBits > 0) {
                if (!tryValidateCurrentByte(databin, state)) {
                    return null;
                }
                
                var bitsToTake = Math.min(
                    state.validBitsInCurrentByte, remainingBits);
                
                var addToResult = state.currentByte >> (8 - bitsToTake);
                result = (result << bitsToTake) + addToResult;
                
                removeBitsFromByte(state, bitsToTake);
                remainingBits -= bitsToTake;
            }
            
            return result;
        };
    }
    
    function countAndShiftBits(databin, state, isUntilZeroBit, maxBitsToShift) {
        var countedBits = 0;
        var foundTerminatingBit;
        var remainingBits = maxBitsToShift;
        
        do {
            if (!tryValidateCurrentByte(databin, state)) {
                return null;
            }
            
            var byteValue = isUntilZeroBit ? ~state.currentByte : state.currentByte;
            var bitsCountIncludingTerminatingBit = Math.min(
                zeroBitsUntilFirstOneBitMap[byteValue],
                state.validBitsInCurrentByte + 1);
            
            var bitsCountNotIncludingTerminatingBit =
                bitsCountIncludingTerminatingBit - 1;
            
            if (remainingBits !== undefined) {
                if (bitsCountIncludingTerminatingBit > remainingBits) {
                    removeBitsFromByte(state, remainingBits);
                    countedBits += remainingBits;
                    break;
                }
                
                remainingBits -= bitsCountNotIncludingTerminatingBit;
            }
            
            countedBits += bitsCountNotIncludingTerminatingBit;
            
            foundTerminatingBit =
                bitsCountIncludingTerminatingBit <= state.validBitsInCurrentByte;

            if (foundTerminatingBit) {
                removeBitsFromByte(state, bitsCountIncludingTerminatingBit);
            } else {
                state.validBitsInCurrentByte = 0;
            }
        } while (!foundTerminatingBit);
        
        return countedBits;
    }
    
    function removeBitsFromByte(state, bitsCount) {
        state.validBitsInCurrentByte -= bitsCount;
        if (state.validBitsInCurrentByte > 0) {
            state.currentByte = (state.currentByte << bitsCount) & 0xFF;
        }
    }

    function tryValidateCurrentByte(databin, state) {
        if (state.validBitsInCurrentByte > 0) {
            return true;
        }
        
        var bytesNeeded = state.isSkipNextByte ? 2 : 1;
        
        var resultArray = [];
        var bytesCopied = databin.copyBytes(resultArray, /*resultStartOffset=*/0, {
            forceCopyAllRange: true,
            databinStartOffset: state.nextOffsetToParse,
            maxLengthToCopy: bytesNeeded
            });
        
        if (bytesCopied !== bytesNeeded) {
            return false;
        }

        var prevByte = state.originalByteWithoutShift;

        state.currentByte = resultArray[bytesNeeded - 1];
        state.validBitsInCurrentByte = 8;
        state.originalByteWithoutShift = state.currentByte;
        
        if (prevByte === 0xFF) {
            if ((resultArray[0] & 0x80) !== 0) {
                throw new jGlobals.j2kExceptions.IllegalDataException(
                    'Expected 0 bit after 0xFF byte', 'B.10.1');
            }
            
            // No need to skip another bit if already skip the whole byte
            if (!state.isSkipNextByte) {
                state.currentByte <<= 1;
                state.validBitsInCurrentByte = 7;
            }
        }
        
        state.isSkipNextByte = false;
        state.nextOffsetToParse += bytesNeeded;
        
        return true;
    }

    function createZeroBitsUntilFirstOneBitMap() {
        var arrayMap = new Array(255);
        
        arrayMap[0x00] = 9;
        arrayMap[0x01] = 8;
        arrayMap[0x02] = 7;
        arrayMap[0x03] = 7;
        
        var i;
        
        for (i = 0x04; i <= 0x07; ++i) {
            arrayMap[i] = 6;
        }
        
        for (i = 0x08; i <= 0x0F; ++i) {
            arrayMap[i] = 5;
        }

        for (i = 0x10; i <= 0x1F; ++i) {
            arrayMap[i] = 4;
        }

        for (i = 0x20; i <= 0x3F; ++i) {
            arrayMap[i] = 3;
        }
        
        for (i = 0x40; i <= 0x7F; ++i) {
            arrayMap[i] = 2;
        }
        
        for (i = 0x80; i <= 0xFF; ++i) {
            arrayMap[i] = 1;
        }
        
        // Avoid two's complement problems
        for (i = 0; i <= 0xFF; ++i) {
            arrayMap[i - 0x100] = arrayMap[i];
        }
        
        return arrayMap;
    }
    
    return JpipBitstreamReader;
})();
},{"j2k-jpip-globals.js":16}],29:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = (function JpipCodeblockLengthParserClosure() {
    // B.10.7.
    
    var exactLog2Table = createExactLog2Table();
    
    function JpipCodeblockLengthParser(bitstreamReader, transactionHelper) {
        var lBlock = transactionHelper.createTransactionalObject({
            lBlockValue: 3
            });
        
        this.parse = function parse(codingPasses) {
            var addToLBlock = bitstreamReader.countOnesAndShiftUntilFirstZeroBit();
            if (addToLBlock === null) {
                return null;
            }
            
            var lBlockState = lBlock.getValue(bitstreamReader.activeTransaction);
            lBlockState.lBlockValue += addToLBlock;
            
            var codingPassesLog2 = exactLog2Table[codingPasses];
            if (codingPassesLog2 === undefined) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Unexpected value of coding passes ' + codingPasses +
                    '. Expected positive integer <= 164');
            }
            
            var bitsCount = lBlockState.lBlockValue + codingPassesLog2;
            var length = bitstreamReader.shiftBits(bitsCount);
            
            return length;
        };
    }
    
    function createExactLog2Table() {
        var maxCodingPassesPossible = 164;
        var result = new Array(maxCodingPassesPossible);
        
        var inputValueLowerBound = 1;
        var inputValueUpperBound = 2;
        var log2Result = 0;
        
        while (inputValueLowerBound <= maxCodingPassesPossible) {
            for (var i = inputValueLowerBound; i < inputValueUpperBound; ++i) {
                result[i] = log2Result;
            }
            
            inputValueLowerBound *= 2;
            inputValueUpperBound *= 2;
            ++log2Result;
        }
        
        return result;
    }
    
    return JpipCodeblockLengthParser;
})();
},{"j2k-jpip-globals.js":16}],30:[function(require,module,exports){
'use strict';

module.exports = (function JpipCodingPassesNumberParserClosure() {
    // Table B.4 in part 1 of the Jpeg2000 standard shows 7 cases
    // of values. The algorithm shown here separates those cases
    // into 16 cases, depends on the number of ones in the prefix
    // of the coded number until the first zero.
    // The parsing is done in two stages: first we count the ones until
    // the first zero, later we parse the other bits.
    
    // For example, the case of 1101 (which represents 4 according to
    // table B.4) is parsed in two stages. First we count the ones in
    // the beginning until the first zero, the result is 2 ('110'). Then we
    // parse the other bits ('1').
    
    // After the first parsing stage (count of ones), we know two things:
    // - How many bits we need to take after the first zero (single bit in
    //   the above case of '110' prefix).
    // - How much we need to add to the result of parsing the other bits (3
    //     in the above case of '110' prefix).
    
    // Actually the 16 cases were extracted from the table without any formula,
    // so we can refer the number of ones as 'keywords' only.

    var bitsNeededAfterCountOfOnes = createBitsNeededAfterCountOfOnesMap();
    var addToResultAfterCountOfOnes = createAddToResultAfterCountOfOnesMap();

    var jpipCodingPassesNumberParser = {
        parse: function parse(bitstreamReader) {
            
            var onesCount = bitstreamReader.countOnesAndShiftUntilFirstZeroBit(
                /*maxBitsToShift=*/16);
            
            if (onesCount === null) {
                return null;
            }
            
            var moreBitsNeeded = bitsNeededAfterCountOfOnes[onesCount];
            var moreBits = bitstreamReader.shiftBits(moreBitsNeeded);
            
            if (moreBits === null) {
                return null;
            }
            
            var addToResult = addToResultAfterCountOfOnes[onesCount];
            var result = moreBits + addToResult;
            
            return result;
        }
    };
    
    function createBitsNeededAfterCountOfOnesMap() {
        var result = new Array(17);
        
        // The case of '0': After 0 ones and single zero, needs no more bits
        result[0] = 0;

        // The case of '10': After 1 ones and single zero, needs no more bits
        result[1] = 0;
        
        // The cases of '110x': After 2 ones and single zero, needs another bit
        result[2] = 1;
        
        // The case of '1110': After 3 ones and single zero, needs no more bits
        result[3] = 0;
        
        // The cases of '1111 0000 0' to '1111 1111 0':
        // After 4 to 8 ones and single zero, needs bits to complete to 9 bits
        result[4] = 4;
        result[5] = 3;
        result[6] = 2;
        result[7] = 1;
        result[8] = 0;
        
        // The cases of '1111 11111 ...'
        // After at least 9 ones and single zero, needs bits to complete to 16 bits
        result[9] = 6;
        result[10] = 5;
        result[11] = 4;
        result[12] = 3;
        result[13] = 2;
        result[14] = 1;
        result[15] = 0;
        
        // The case of '1111 11111 1111 111'
        result[16] = 0;
        
        return result;
    }
    
    function createAddToResultAfterCountOfOnesMap() {
        var result = new Array(17);
        
        // The case of '0' (codeword for 1):
        // After 0 ones and single zero, add 1 to other 0 bits value
        result[0] = 1;

        // The case of '10' (codeword for 2):
        // After 1 ones and single zero, add 2 to other 0 bits value
        result[1] = 2;
        
        // The cases of '110x' (codewords for 3 and 4):
        // After 2 ones and single zero, add 3 to other single bit value
        result[2] = 3;
        
        // The case of '1110' (codeword for 5):
        // After 3 ones and single zero, add 5 to other 0 bits value
        result[3] = 5;
        
        // The cases of '1111 0000 0' to '1111 1111 0' (codewords for 6 to 36):
        // After 4 ones and single zero, add 6 to other 0/1/2/3/4 bits value
        result[4] = 6 + 0x00; // b00000
        result[5] = 6 + 0x10; // b10000
        result[6] = 6 + 0x18; // b11000
        result[7] = 6 + 0x1C; // b11100
        result[8] = 6 + 0x1E; // b11110
        
        // The cases of '1111 11111 ...' (codewords for 37 to 164):
        // After 9 ones and single zero, add 37 to other 0/1/2/3/4/5/6 bits value
        result[ 9] = 37 + 0x00; // b000000
        result[10] = 37 + 0x40; // b100000
        result[11] = 37 + 0x60; // b110000
        result[12] = 37 + 0x70; // b111000
        result[13] = 37 + 0x78; // b111100
        result[14] = 37 + 0x7C; // b111110
        result[15] = 37 + 0x7E; // b111111
        result[16] = 37 + 0x7F; // b111111
        
        return result;
    }
    
    return jpipCodingPassesNumberParser;
})();
},{}],31:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipPacketLengthCalculator(
    tileStructure,
    componentStructure,
    databin,
    startOffsetInDatabin,
    precinct,
    jpipFactory) {
    
    var calculatedLengths = [];
    
    var bitstreamReader = jpipFactory.createBitstreamReader(databin);
    
    var numCodeblocksX =
        componentStructure.getNumCodeblocksXInPrecinct(precinct);
    var numCodeblocksY =
        componentStructure.getNumCodeblocksYInPrecinct(precinct);
        
    var numQualityLayersInTile = tileStructure.getNumQualityLayers();
    var isPacketHeaderNearData = tileStructure.getIsPacketHeaderNearData();
    var isStartOfPacketMarkerAllowed = tileStructure.getIsStartOfPacketMarkerAllowed();
    var isEndPacketHeaderMarkerAllowed =
        tileStructure.getIsEndPacketHeaderMarkerAllowed();
    
    var subbandParsers = initSubbandParsers();
    
    this.calculateEndOffsetOfLastFullPacket =
        function calculateFullPacketsAvailableOffsets(quality) {
        
        var isAllowedFullQuality =
            quality === undefined ||
            quality >= numQualityLayersInTile;
        
        var numQualityLayersToParse;
        if (!isAllowedFullQuality) {
            numQualityLayersToParse = quality;
        } else if (!databin.isAllDatabinLoaded()) {
            numQualityLayersToParse = numQualityLayersInTile;
        } else {
            var endOffset = databin.getDatabinLengthIfKnown();
            
            return {
                endOffset: endOffset,
                numQualityLayers: numQualityLayersInTile
                };
        }
        
        checkSupportedStructure();
        
        tryValidatePackets(numQualityLayersToParse);
        var result = getFullQualityLayersEndOffset(numQualityLayersToParse);
        
        return result;
    };
    
    this.getPacketOffsetsByCodeblockIndex = function getPacketOffsetsByCodeblockIndex(
        qualityLayer) {
        
        checkSupportedStructure();
        tryValidatePackets(qualityLayer + 1);
        
        if (calculatedLengths.length <= qualityLayer) {
            return null;
        }
        
        return calculatedLengths[qualityLayer];
    };
    
    function tryValidatePackets(qualityLayers) {
        while (calculatedLengths.length < qualityLayers) {
            bitstreamReader.startNewTransaction();
            
            var nextPacket = tryCalculateNextPacketLength(
                calculatedLengths.length);
            
            if (nextPacket === null) {
                bitstreamReader.activeTransaction.abort();
                return;
            }
            
            calculatedLengths.push(nextPacket);
            bitstreamReader.activeTransaction.commit();
        }
    }
    
    function tryCalculateNextPacketLength(qualityLayer) {
        var headerStartOffset;
        if (qualityLayer > 0) {
            var last = calculatedLengths[qualityLayer - 1];
            headerStartOffset =
                last.headerStartOffset +
                last.headerLength +
                last.overallBodyLengthBytes;
        } else {
            headerStartOffset = startOffsetInDatabin;
        }
            
        bitstreamReader.databinOffset = headerStartOffset;
        
        if (isPacketHeaderNearData && isStartOfPacketMarkerAllowed) {
            var isMarker = isMarkerHere(0x91);
            
            if (isMarker === null) {
                return null;
            } else if (isMarker) {
                var startOfPacketSegmentLength = 6;
                bitstreamReader.databinOffset += startOfPacketSegmentLength;
            }
        }
        
        var isPacketExistInQualityLayer = bitstreamReader.shiftBit();
        if (isPacketExistInQualityLayer === null) {
            return null;
        }
        
        if (!isPacketExistInQualityLayer) {
            bitstreamReader.shiftRemainingBitsInByte();
        
            return {
                headerStartOffset: headerStartOffset,
                headerLength: 1,
                codeblockBodyLengthByIndex: [],
                overallBodyLengthBytes: 0
                };
        }
        
        var bodyLength = actualCalculatePacketLengthAfterZeroLengthBit(
            qualityLayer);
        if (bodyLength === null) {
            return null;
        }
        
        var headerEndOffset = bitstreamReader.databinOffset;
        bodyLength.headerLength = headerEndOffset - headerStartOffset;

        bodyLength.headerStartOffset = headerStartOffset;
        
        return bodyLength;
    }
    
    function actualCalculatePacketLengthAfterZeroLengthBit(qualityLayer) {
        var bodyBytes = 0;
        var codeblockBodyLengthByIndex = null;
        
        for (var subband = 0; subband < subbandParsers.length; ++subband) {
            var parser = subbandParsers[subband];
            var subbandBodyLength = parser.calculateSubbandLength(qualityLayer);
            
            if (subbandBodyLength === null) {
                return null;
            }
            
            if (codeblockBodyLengthByIndex === null) {
                codeblockBodyLengthByIndex =
                    subbandBodyLength.codeblockBodyLengthByIndex;
            } else {
                codeblockBodyLengthByIndex = codeblockBodyLengthByIndex.concat(
                    subbandBodyLength.codeblockBodyLengthByIndex);
            }
            
            bodyBytes += subbandBodyLength.overallBodyLengthBytes;
        }

        bitstreamReader.shiftRemainingBitsInByte();
        
        if (isEndPacketHeaderMarkerAllowed) {
            var isMarker = isMarkerHere(0x92);
            
            if (isMarker === null) {
                return null;
            } else if (isMarker) {
                var endPacketHeaderMarkerLength = 2;
                bitstreamReader.databinOffset += endPacketHeaderMarkerLength;
            }
        }
        
        return {
            codeblockBodyLengthByIndex: codeblockBodyLengthByIndex,
            overallBodyLengthBytes: bodyBytes
            };
    }
    
    function getFullQualityLayersEndOffset(quality) {
        var numParsedQualityLayer = Math.min(
            quality, calculatedLengths.length);
        
        if (numParsedQualityLayer === 0) {
            return {
                endOffset: startOffsetInDatabin,
                numQualityLayers: 0
                };
        }
        
        var lastPacket = calculatedLengths[numParsedQualityLayer - 1];
        var endOffset =
            lastPacket.headerStartOffset +
            lastPacket.headerLength +
            lastPacket.overallBodyLengthBytes;
        
        var result = {
            endOffset: endOffset,
            numQualityLayers: numParsedQualityLayer
            };
        
        return result;
    }
    
    function initSubbandParsers() {
        var numSubbands = precinct.resolutionLevel === 0 ? 1 : 3;
        var result = [];
        
        for (var i = 0; i < numSubbands; ++i) {
            var numCodeblocksXInSubband;
            var numCodeblocksYInSubband;
            if (precinct.resolutionLevel === 0) {
                numCodeblocksXInSubband = numCodeblocksX;
                numCodeblocksYInSubband = numCodeblocksY;
            } else {
                // Treat the edge case of single redundant pixels column
                // (In other cases, numCodeblocksX is full duplication of 2.
                // See JpipComponentStructure implementation).
                if (i === 1) { // LH
                    numCodeblocksXInSubband = Math.ceil(numCodeblocksX / 2);
                } else { // HL or HH
                    numCodeblocksXInSubband = Math.floor(numCodeblocksX / 2);
                }
                
                // Treat the edge case of single redundant pixels row
                // (In other cases, numCodeblocksY is full duplication of 2.
                // See JpipComponentStructure implementation).
                if (i === 0) { // HL
                    numCodeblocksYInSubband = Math.ceil(numCodeblocksY / 2);
                } else { // LH or HH
                    numCodeblocksYInSubband = Math.floor(numCodeblocksY / 2);
                }
            }
            
            if (numCodeblocksXInSubband === 0 || numCodeblocksYInSubband === 0) {
                continue;
            }
            
            result.push(jpipFactory.createSubbandLengthInPacketHeaderCalculator(
                bitstreamReader,
                numCodeblocksXInSubband,
                numCodeblocksYInSubband));
        }
        
        return result;
    }
    
    function isMarkerHere(markerSecondByte) {
        var possibleMarker = new Array(2);
        var bytesCopied = databin.copyBytes(
            possibleMarker,
            /*resultStartOffset=*/0,
            {
                databinStartOffset: bitstreamReader.databinOffset,
                maxLengthToCopy: 2,
                forceCopyAllRange: false
            });
        
        switch (bytesCopied) {
            case 2:
                var isMarker =
                    possibleMarker[0] === 0xFF &&
                    possibleMarker[1] === markerSecondByte;
                
                return isMarker;

            case 1:
                if (possibleMarker[0] === 0xFF) {
                    return null;
                }
                
                return false;
            
            default:
                return null;
        }
    }
    
    function checkSupportedStructure() {
        if (!isPacketHeaderNearData) {
            throw new jGlobals.jpipExceptions.UnsupportedFeatureException(
                'PPM or PPT', 'A.7.4 and A.7.5');
        }
    }
};
},{"j2k-jpip-globals.js":16}],32:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipQualityLayersCache(
    codestreamStructure, jpipFactory) {
    
    var CACHE_KEY = 'packetLengthCalculator';
    
    this.getPacketOffsetsByCodeblockIndex =
        function getPacketOffsetsByCodeblockIndex(
            precinctDatabin, qualityLayer, precinctPosition) {
        
        var packetLengthCalculator = getPacketParser(
            precinctDatabin, precinctPosition);
            
        var result = packetLengthCalculator.getPacketOffsetsByCodeblockIndex(
            qualityLayer);
        
        return result;
    };
    
    this.getQualityLayerOffset = function getQualityLayerOffset(
        precinctDatabin, quality, precinctPosition) {
        
        var loadedRanges = precinctDatabin.getExistingRanges();
        var endOffsetLoaded;
        
        var packetLengthCalculator = getPacketParser(
            precinctDatabin, precinctPosition);
            
        if (loadedRanges.length < 1 || loadedRanges[0].start > 0) {
            endOffsetLoaded = 0;
            quality = 0;
        } else {
            endOffsetLoaded = loadedRanges[0].start + loadedRanges[0].length;
        }
        
        var layersInPrecinct =
            packetLengthCalculator.calculateEndOffsetOfLastFullPacket(
                quality);
        
        while (endOffsetLoaded < layersInPrecinct.endOffset) {
            var reducedLayersToSearch = layersInPrecinct.numQualityLayers - 1;
            layersInPrecinct = packetLengthCalculator
                .calculateEndOffsetOfLastFullPacket(reducedLayersToSearch);
        }
        
        return layersInPrecinct;
    };

    function getPacketParser(precinctDatabin, precinctPosition) {
        var packetLengthCalculatorContainer =
            precinctDatabin.getCachedData(CACHE_KEY);
        
        if (packetLengthCalculatorContainer.calculator !== undefined) {
            return packetLengthCalculatorContainer.calculator;
        }
        
        if (precinctPosition === undefined) {
            throw new jGlobals.jpipExceptions.InternalErrorException('precinctPosition ' +
                'should be given on the first time of using QualityLayersCache ' +
                'on this precinct');
        }
        
        var tileStructure = codestreamStructure.getTileStructure(
            precinctPosition.tileIndex);
        
        var componentStructure = tileStructure.getComponentStructure(
            precinctPosition.component);
            
        packetLengthCalculatorContainer.calculator =
            jpipFactory.createPacketLengthCalculator(
                tileStructure,
                componentStructure,
                precinctDatabin,
                /*startOffsetInDatabin=*/0,
                precinctPosition);
        
        return packetLengthCalculatorContainer.calculator;
    }
};
},{"j2k-jpip-globals.js":16}],33:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports =
    function JpipSubbandLengthInPacketHeaderCalculator(
        bitstreamReader,
        numCodeblocksX,
        numCodeblocksY,
        codingPassesNumberParser,
        transactionHelper,
        jpipFactory) {
    
    var codeblockLengthParsers = null;
    var isCodeblocksIncluded = null;
    var parsedQualityLayers = transactionHelper.createTransactionalObject(
        0, /*isValueType=*/true);
        
    var inclusionTree = jpipFactory.createTagTree(
        bitstreamReader, numCodeblocksX, numCodeblocksY);
    
    var zeroBitPlanesTree = jpipFactory.createTagTree(
        bitstreamReader, numCodeblocksX, numCodeblocksY);
    
    this.calculateSubbandLength = function calcualteSubbandLength(qualityLayer) {
        ensureQualityLayerNotParsedYet(qualityLayer);
        
        lazyInitArrays();
        
        inclusionTree.setMinimalValueIfNotReadBits(qualityLayer);
        
        var accumulatedBodyLengthBytes = 0;
        var codeblockIndex = 0;
        var codeblockLengthByIndex = new Array(numCodeblocksX * numCodeblocksY);
        
        for (var y = 0; y < numCodeblocksY; ++y) {
            for (var x = 0; x < numCodeblocksX; ++x) {
                var codeblockBodyLength = getNextCodeblockLength(x, y, qualityLayer);
                if (codeblockBodyLength === null) {
                    return null;
                }
                
                codeblockLengthByIndex[codeblockIndex++] = codeblockBodyLength;
                
                accumulatedBodyLengthBytes +=
                    codeblockBodyLength.codeblockBodyLengthBytes;
            }
        }
        
        parsedQualityLayers.setValue(
            bitstreamReader.activeTransaction, qualityLayer + 1);
        
        return {
            codeblockBodyLengthByIndex: codeblockLengthByIndex,
            overallBodyLengthBytes: accumulatedBodyLengthBytes
            };
    };
    
    function ensureQualityLayerNotParsedYet(qualityLayer) {
        var parsedQualityLayersValue = parsedQualityLayers.getValue(
            bitstreamReader.activeTransaction);
        
        if (parsedQualityLayersValue >= qualityLayer + 1) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Unexpected quality layer to parse');
        }
    }
    
    function lazyInitArrays() {
        if (codeblockLengthParsers !== null) {
            return;
        }
        
        codeblockLengthParsers = new Array(numCodeblocksX);
        isCodeblocksIncluded = new Array(numCodeblocksX);
        
        for (var x = 0; x < numCodeblocksX; ++x) {
            codeblockLengthParsers[x] = new Array(numCodeblocksY);
            isCodeblocksIncluded[x] = new Array(numCodeblocksY);
            
            for (var y = 0; y < numCodeblocksY; ++y) {
                codeblockLengthParsers[x][y] =
                    jpipFactory.createCodeblockLengthParser(
                        bitstreamReader, transactionHelper);
                    
                isCodeblocksIncluded[x][y] = transactionHelper
                    .createTransactionalObject({ isIncluded: false });
            }
        }
    }
    
    function getNextCodeblockLength(x, y, qualityLayer) {
        var isCodeblockAlreadyIncluded = isCodeblocksIncluded[x][y].getValue(
            bitstreamReader.activeTransaction);
        
        var isCodeblockIncludedNow;
        if (isCodeblockAlreadyIncluded.isIncluded) {
            isCodeblockIncludedNow = bitstreamReader.shiftBit();
        } else {
            isCodeblockIncludedNow = inclusionTree.isSmallerThanOrEqualsTo(
                x, y, qualityLayer);
        }
            
        if (isCodeblockIncludedNow === null) {
            return null;
        } else if (!isCodeblockIncludedNow) {
            return {
                codeblockBodyLengthBytes: 0,
                codingPasses: 0
                };
        }
        
        var zeroBitPlanes = null;
        if (!isCodeblockAlreadyIncluded.isIncluded) {
            zeroBitPlanes = zeroBitPlanesTree.getValue(x, y);
            if (zeroBitPlanes === null) {
                return null;
            }
        }
        
        var codingPasses = codingPassesNumberParser.parse(bitstreamReader);
        if (codingPasses === null) {
            return null;
        }
        
        var lengthParser = codeblockLengthParsers[x][y];
        var bodyLengthBytes = lengthParser.parse(codingPasses);
        
        if (bodyLengthBytes === null) {
            return null;
        }
        
        isCodeblockAlreadyIncluded.isIncluded = true;
        
        var result = {
            codeblockBodyLengthBytes: bodyLengthBytes,
            codingPasses: codingPasses
            };
        
        if (zeroBitPlanes !== null) {
            result.zeroBitPlanes = zeroBitPlanes;
        }
        
        return result;
    }
};
},{"j2k-jpip-globals.js":16}],34:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipTagTree(
    bitstreamReader, width, height, transactionHelper) {
    
    var isAlreadyReadBitsTransactionalObject =
        transactionHelper.createTransactionalObject(false, /*isValueType=*/true);
    var levels;
    
    createLevelsArray();
        
    this.setMinimalValueIfNotReadBits = function setMinimalValueIfNotReadBits(
        minimalValue) {
    
        if (isAlreadyReadBits()) {
            return;
        }
        
        var transactionalObject = levels[0].content[0];
        var node = transactionalObject.getValue(
            bitstreamReader.activeTransaction);
        
        node.minimalPossibleValue = minimalValue;
    };
    
    this.isSmallerThanOrEqualsTo = function isSmallerThanOrEqualsTo(
        x, y, value) {
        
        setAlreadyReadBits();
        
        var getNextNode = getRootToLeafIterator(x, y);
        var currentNode = getNextNode();
        var lastNode;
        
        while (currentNode !== null) {
            if (currentNode.minimalPossibleValue > value) {
                return false;
            }
            
            if (!currentNode.isFinalValue) {
                var maxBitsToShift = value - currentNode.minimalPossibleValue + 1;
                var addToValue = bitstreamReader.countZerosAndShiftUntilFirstOneBit(
                    maxBitsToShift);
                    
                if (addToValue === null) {
                    return null;
                }
                
                currentNode.minimalPossibleValue += addToValue;
                
                if (addToValue < maxBitsToShift) {
                    currentNode.isFinalValue = true;
                }
            }
            
            lastNode = currentNode;
            currentNode = getNextNode();
        }
        
        var result = lastNode.minimalPossibleValue <= value;
        if (result && !lastNode.isFinalValue) {
            throw new jGlobals.jpipExceptions.InternalErrorException(
                'Wrong parsing in TagTree.isSmallerThanOrEqualsTo: ' +
                'not sure if value is smaller than asked');
        }
        
        return result;
    };
    
    this.getValue = function getValue(x, y) {
        var getNextNode = getRootToLeafIterator(x, y);
        var currentNode = getNextNode();
        var leaf;
        
        setAlreadyReadBits();
        
        while (currentNode !== null) {
            if (!currentNode.isFinalValue) {
                var addToValue =
                    bitstreamReader.countZerosAndShiftUntilFirstOneBit();
                
                if (addToValue === null) {
                    return null;
                }

                currentNode.minimalPossibleValue += addToValue;
                currentNode.isFinalValue = true;
            }
            
            leaf = currentNode;
            currentNode = getNextNode();
        }
        
        return leaf.minimalPossibleValue;
    };
    
    function createLevelsArray() {
        levels = [];
        var levelWidth = width;
        var levelHeight = height;
        
        while (levelWidth >= 1 || levelHeight >= 1) {
            levelWidth = Math.ceil(levelWidth);
            levelHeight = Math.ceil(levelHeight);
            
            var elementCount = levelWidth * levelHeight;
            levels.unshift({
                width: levelWidth,
                height: levelHeight,
                content: new Array(elementCount)
                });
            
            levelWidth /= 2;
            levelHeight /= 2;
        }
        
        initNode(0, 0);
    }
    
    function getRootToLeafIterator(x, y) {
        var level = 0;
        var prevIteratedNode = null;
        
        function getNext() {
            if (level === null) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Iterated too deep in tag tree');
            }
            
            if (level === levels.length) {
                level = null;
                return null;
            }
            
            var shiftFactor = levels.length - level - 1;
            var currentX = Math.floor(x >> shiftFactor);
            var currentY = Math.floor(y >> shiftFactor);
            
            var indexInLevel = levels[level].width * currentY + currentX;
            
            var transactionalObject = levels[level].content[indexInLevel];
            
            if (transactionalObject === undefined) {
                transactionalObject = initNode(level, indexInLevel);
            }
            
            var result = transactionalObject.getValue(
                bitstreamReader.activeTransaction);
            
            if (prevIteratedNode !== null &&
                prevIteratedNode.minimalPossibleValue > result.minimalPossibleValue) {
                
                result.minimalPossibleValue = prevIteratedNode.minimalPossibleValue;
            }

            prevIteratedNode = result;
            ++level;
            return result;
        }
        
        return getNext;
    }
    
    function initNode(level, indexInLevel) {
        var objectValue = {
            minimalPossibleValue: 0,
            isFinalValue: false
            };
            
        var transactionalObject = transactionHelper.createTransactionalObject(
            objectValue);
        
        levels[level].content[indexInLevel] = transactionalObject;
        return transactionalObject;
    }
    
    function isAlreadyReadBits() {
        var isAlreadyReadBitsTransactionalValue =
            isAlreadyReadBitsTransactionalObject.getValue(
                bitstreamReader.activeTransaction);
        
        return isAlreadyReadBitsTransactionalValue;
    }
    
    function setAlreadyReadBits() {
        isAlreadyReadBitsTransactionalObject.setValue(
            bitstreamReader.activeTransaction, true);
    }
};
},{"j2k-jpip-globals.js":16}],35:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = {
    createTransaction: function createTransaction() {
        // This code is executed a LOT. For optimization, state is represented
        // directly as numbers (I couldn't think about more readable way which
        // is performance-equivalent).
        
        // state = 1 ==> Transaction is active
        // state = 2 ==> Transaction has committed successfully
        // state = 3 ==> Transaction has been aborted
        
        var state = 1;
        
        var transaction = {
            get isAborted() {
                return state === 3;
            },
            
            get isActive() {
                return state === 1;
            },
            
            commit: function commit() {
                terminate(true);
            },
        
            abort: function abort() {
                terminate(false);
            }
        };
        
        function terminate(isSuccessful_) {
            if (!transaction.isActive) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Cannot terminate an already terminated transaction');
            }
            state = isSuccessful_ ? 2 : 3;
        }
            
        return transaction;
    },
    
    createTransactionalObject: function commitTransaction(
        initialValue, isValueType) {
        
        var value = null;
        var prevValue = initialValue;
        var lastAccessedTransaction = {
            isActive: false,
            isAborted: true
            };
        var clone = isValueType ? cloneValueType : cloneByJSON;
        
        var transactionalObject = {
            getValue: function getValue(activeTransaction) {
                ensureAllowedAccess(activeTransaction);

                if (lastAccessedTransaction === activeTransaction) {
                    return value;
                }
                
                if (lastAccessedTransaction.isAborted) {
                    value = clone(prevValue);
                } else {
                    prevValue = clone(value);
                }

                lastAccessedTransaction = activeTransaction;
                return value;
            },
            
            setValue: function setValue(activeTransaction, newValue) {
                ensureAllowedAccess(activeTransaction);

                if (lastAccessedTransaction === activeTransaction) {
                    value = newValue;
                    return;
                }
                
                if (!lastAccessedTransaction.isAborted) {
                    prevValue = clone(value);
                }
                
                lastAccessedTransaction = activeTransaction;
                value = newValue;
            }
        };
        
        function ensureAllowedAccess(activeTransaction) {
            if (!activeTransaction.isActive) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Cannot use terminated transaction to access objects');
            }
            
            if (activeTransaction !== lastAccessedTransaction &&
                lastAccessedTransaction.isActive) {
                
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'Cannot simultanously access transactional object ' +
                    'from two active transactions');
            }
        }
        
        function cloneValueType(value) {
            return value;
        }
        
        function cloneByJSON(value) {
            var newValue = JSON.parse(JSON.stringify(value));
            return newValue;
        }
        
        return transactionalObject;
    }
};
},{"j2k-jpip-globals.js":16}],36:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports.JpipImage = require('jpip-image.js');
module.exports.PdfjsJpxDecoder = require('pdfjs-jpx-decoder.js');
module.exports.j2kExceptions = jGlobals.j2kExceptions;
module.exports.jpipExceptions = jGlobals.jpipExceptions;
module.exports.Internals = {
    jpipRuntimeFactory: require('jpip-runtime-factory.js'),
    jGlobals: jGlobals
};
},{"j2k-jpip-globals.js":16,"jpip-image.js":4,"jpip-runtime-factory.js":17,"pdfjs-jpx-decoder.js":6}],37:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipCodestreamReconstructor(
    codestreamStructure,
    databinsSaver,
    headerModifier,
    qualityLayersCache) {
    
    this.reconstructCodestream = function reconstructCodestream(
        minNumQualityLayers) {
        
        var result = [];
        var currentOffset = createMainHeader(result);
        
        if (currentOffset === null) {
            return null;
        }
        
        var numTiles =
            codestreamStructure.getNumTilesX() * codestreamStructure.getNumTilesY();
        
        var codestreamPart;
        
        if (minNumQualityLayers === undefined) {
            minNumQualityLayers = 'max';
        }
        
        for (var tileId = 0; tileId < numTiles; ++tileId) {
            var tileBytesCopied = createTile(
                result,
                currentOffset,
                tileId,
                tileId,
                codestreamPart,
                minNumQualityLayers);
            
            currentOffset += tileBytesCopied;
            
            if (tileBytesCopied === null) {
                return null;
            }
        }
        
        var markerBytesCopied = copyBytes(
            result, currentOffset, jGlobals.j2kMarkers.EndOfCodestream);
        currentOffset += markerBytesCopied;
        result.length = currentOffset;

        return result;
    };
    
    this.createCodestreamForRegion = function createCodestreamForRegion(
        params, minNumQualityLayers, isOnlyHeadersWithoutBitstream) {
        
        var codestream = [];
        var currentOffset = createMainHeader(
            codestream, params.level);
        
        if (currentOffset === null) {
            return null;
        }
        
        var tileIdToWrite = 0;
        var tileIterator = codestreamStructure.getTilesIterator(params);
        
        var firstTileId = tileIterator.tileIndex;
        
        var firstTileLeft = codestreamStructure.getTileLeft(
            firstTileId, params.level);
        var firstTileTop = codestreamStructure.getTileTop(
            firstTileId, params.level);
            
        var offsetX = params.minX - firstTileLeft;
        var offsetY = params.minY - firstTileTop;
        
        do {
            var tileIdOriginal = tileIterator.tileIndex;
            
            var tileBytesCopied = createTile(
                codestream,
                currentOffset,
                tileIdToWrite++,
                tileIdOriginal,
                params,
                minNumQualityLayers,
                isOnlyHeadersWithoutBitstream);
                
            currentOffset += tileBytesCopied;
        
            if (tileBytesCopied === null) {
                return null;
            }
        } while (tileIterator.tryAdvance());
        
        var markerBytesCopied = copyBytes(
            codestream, currentOffset, jGlobals.j2kMarkers.EndOfCodestream);
        currentOffset += markerBytesCopied;

        headerModifier.modifyImageSize(codestream, params);
        
        if (codestream === null) {
            return null;
        }
        
        codestream.length = currentOffset;

        return {
            codestream: codestream,
            offsetX: offsetX,
            offsetY: offsetY
            };
    };
    
    this.createCodestreamForTile = function createCodestreamForTile(
        tileId,
        level,
        minNumQualityLayers,
        quality) {
        
        var result = [];
        var currentOffset = createMainHeader(result, level);
        
        if (currentOffset === null) {
            return null;
        }
        
        // TODO: Delete this function and test createCodestreamForRegion instead
        
        var codestreamPartParams = {
            level: level,
            quality: quality
            };
        
        var tileBytesCopied = createTile(
            result,
            currentOffset,
            /*tileIdToWrite=*/0,
            /*tileIdOriginal=*/tileId,
            codestreamPartParams,
            minNumQualityLayers);
            
        currentOffset += tileBytesCopied;
        
        if (tileBytesCopied === null) {
            return null;
        }

        var markerBytesCopied = copyBytes(
            result, currentOffset, jGlobals.j2kMarkers.EndOfCodestream);
        currentOffset += markerBytesCopied;
        
        var numTilesX = codestreamStructure.getNumTilesX();
        var tileX = tileId % numTilesX;
        var tileY = Math.floor(tileId / numTilesX);
        
        headerModifier.modifyImageSize(result, {
            level: level,
            minTileX: tileX,
            maxTileXExclusive: tileX + 1,
            minTileY: tileY,
            maxTileYExclusive: tileY + 1
            });
        
        result.length = currentOffset;
        
        return result;
    };
    
    function createMainHeader(result, level) {
        if (databinsSaver.getIsJpipTilePartStream()) {
            throw new jGlobals.jpipExceptions.UnsupportedFeatureException(
                'reconstruction of codestream from JPT (Jpip Tile-part) stream', 'A.3.4');
        }
        
        var mainHeader = databinsSaver.getMainHeaderDatabin();
        var currentOffset = mainHeader.copyBytes(result, /*startOffset=*/0, {
            forceCopyAllRange: true
            });
        
        if (currentOffset === null) {
            return null;
        }
        
        var bytesAdded = headerModifier.modifyMainOrTileHeader(
            result, mainHeader, /*offset=*/0, level);
        
        currentOffset += bytesAdded;
        
        bytesAdded = addMamazavComment(result, currentOffset);
        currentOffset += bytesAdded;
        
        return currentOffset;
    }
    
    function createTile(
        result,
        currentOffset,
        tileIdToWrite,
        tileIdOriginal,
        codestreamPartParams,
        minNumQualityLayers,
        isOnlyHeadersWithoutBitstream) {
        
        var tileStructure = codestreamStructure.getTileStructure(
            tileIdOriginal);

        var startTileOffset = currentOffset;
        var tileHeaderDatabin = databinsSaver.getTileHeaderDatabin(
            tileIdOriginal);
        
        var level;
        if (codestreamPartParams !== undefined) {
            level = codestreamPartParams.level;
        }
        
        var tileHeaderOffsets = createTileHeaderAndGetOffsets(
            result,
            currentOffset,
            tileHeaderDatabin,
            tileIdToWrite,
            level);
        
        if (tileHeaderOffsets === null) {
            return null;
        }
            
        currentOffset = tileHeaderOffsets.endTileHeaderOffset;
        
        if (!isOnlyHeadersWithoutBitstream) {
            var tileBytesCopied = createTileBitstream(
                result,
                currentOffset,
                tileStructure,
                tileIdOriginal,
                codestreamPartParams,
                minNumQualityLayers);
                
            currentOffset += tileBytesCopied;
            
            if (tileBytesCopied === null) {
                return null;
            }
        }

        var endTileOffset = currentOffset;
        
        var headerAndDataLength =
            endTileOffset - tileHeaderOffsets.startOfTileHeaderOffset;

        headerModifier.modifyInt32(
            result,
            tileHeaderOffsets.headerAndDataLengthPlaceholderOffset,
            headerAndDataLength);

        var bytesCopied = endTileOffset - startTileOffset;
        return bytesCopied;
    }
    
    function createTileHeaderAndGetOffsets(
        result,
        currentOffset,
        tileHeaderDatabin,
        tileIdToWrite,
        level) {
        
        var startOfTileHeaderOffset = currentOffset;
    
        var bytesCopied = copyBytes(
            result, currentOffset, jGlobals.j2kMarkers.StartOfTile);
        currentOffset += bytesCopied;
        
        // A.4.2
        
        var startOfTileSegmentLength = [0, 10]; // Lsot
        bytesCopied = copyBytes(result, currentOffset, startOfTileSegmentLength);
        currentOffset += bytesCopied;
        
        var tileIndex = [tileIdToWrite >>> 8, tileIdToWrite & 0xFF]; // Isot
        bytesCopied = copyBytes(result, currentOffset, tileIndex);
        currentOffset += bytesCopied;
        
        var headerAndDataLengthPlaceholderOffset = currentOffset;
        var headerAndDataLengthPlaceholder = [0, 0, 0, 0]; // Psot
        bytesCopied = copyBytes(result, currentOffset, headerAndDataLengthPlaceholder);
        currentOffset += bytesCopied;
        
        var tilePartIndex = [0]; // TPsot
        bytesCopied = copyBytes(result, currentOffset, tilePartIndex);
        currentOffset += bytesCopied;
        
        var numberOfTileparts = [1]; // TNsot
        bytesCopied = copyBytes(result, currentOffset, numberOfTileparts);
        currentOffset += bytesCopied;
        
        var afterStartOfTileSegmentOffset = currentOffset;
        bytesCopied = tileHeaderDatabin.copyBytes(result, currentOffset, {
            forceCopyAllRange: true
            });
        currentOffset += bytesCopied;
        
        if (bytesCopied === null) {
            // NOTE: Can create empty tile
            return null;
        }
        
        var isEndedWithStartOfDataMarker =
            result[currentOffset - 2] === jGlobals.j2kMarkers.StartOfData[0] &&
            result[currentOffset - 1] === jGlobals.j2kMarkers.StartOfData[1];
            
        if (!isEndedWithStartOfDataMarker) {
            bytesCopied = copyBytes(
                result, currentOffset, jGlobals.j2kMarkers.StartOfData);
            currentOffset += bytesCopied;
        }
        
        var bytesAdded = headerModifier.modifyMainOrTileHeader(
            result,
            tileHeaderDatabin,
            afterStartOfTileSegmentOffset,
            level);
        
        currentOffset += bytesAdded;

        var offsets = {
            startOfTileHeaderOffset: startOfTileHeaderOffset,
            headerAndDataLengthPlaceholderOffset: headerAndDataLengthPlaceholderOffset,
            endTileHeaderOffset: currentOffset
            };
        
        return offsets;
    }
    
    function createTileBitstream(
        result,
        currentOffset,
        tileStructure,
        tileIdOriginal,
        codestreamPartParams,
        minNumQualityLayers) {
        
        var numQualityLayersInTile = tileStructure.getNumQualityLayers();
        var quality;
        var iterator = tileStructure.getPrecinctIterator(
            tileIdOriginal,
            codestreamPartParams,
            /*isIteratePrecinctsNotInCodestreamPart=*/true);

        var allBytesCopied = 0;
        var hasMorePackets;
        
        if (codestreamPartParams !== undefined) {
            quality = codestreamPartParams.quality;
        }
        
        if (minNumQualityLayers === 'max') {
            minNumQualityLayers = numQualityLayersInTile;
        }
        
        do {
            var emptyPacketsToPush = numQualityLayersInTile;
            
            if (iterator.isInCodestreamPart) {
                var inClassId =
                    tileStructure.precinctPositionToInClassIndex(iterator);
                var precinctDatabin = databinsSaver.getPrecinctDatabin(inClassId);
                
                var qualityLayerOffset = qualityLayersCache.getQualityLayerOffset(
                    precinctDatabin,
                    quality,
                    iterator);
                
                var bytesToCopy = qualityLayerOffset.endOffset;
                emptyPacketsToPush =
                    numQualityLayersInTile - qualityLayerOffset.numQualityLayers;
                
                if (qualityLayerOffset.numQualityLayers < minNumQualityLayers) {
                    return null;
                }
                
                var bytesCopied = precinctDatabin.copyBytes(result, currentOffset, {
                    forceCopyAllRange: true,
                    maxLengthToCopy: bytesToCopy
                    });
                
                if (bytesCopied === null) {
                    bytesCopied = 0;
                    emptyPacketsToPush = numQualityLayersInTile;
                }
                
                allBytesCopied += bytesCopied;
                currentOffset += bytesCopied;
            }
            
            for (var i = 0; i < emptyPacketsToPush; ++i) {
                result[currentOffset++] = 0;
            }
            allBytesCopied += emptyPacketsToPush;
        }
        while (iterator.tryAdvance());
        
        return allBytesCopied;
    }
    
    function addMamazavComment(result, currentOffset) {
        var startOffset = currentOffset;
    
        result[currentOffset++] = 0xFF;
        result[currentOffset++] = 0x64;
        result[currentOffset++] = 0x00;
        result[currentOffset++] = 0x09;
        result[currentOffset++] = 77;
        result[currentOffset++] = 97;
        result[currentOffset++] = 109;
        result[currentOffset++] = 97;
        result[currentOffset++] = 122;
        result[currentOffset++] = 97;
        result[currentOffset++] = 118;
        
        var bytesAdded = currentOffset - startOffset;
        return bytesAdded;
    }
        
    function copyBytes(result, resultStartOffset, bytesToCopy) {
        for (var i = 0; i < bytesToCopy.length; ++i) {
            result[i + resultStartOffset] = bytesToCopy[i];
        }
        
        return bytesToCopy.length;
    }
};
},{"j2k-jpip-globals.js":16}],38:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipHeaderModifier(
    codestreamStructure, offsetsCalculator, progressionOrder) {

    var encodedProgressionOrder = encodeProgressionOrder(progressionOrder);
        
    this.modifyMainOrTileHeader = function modifyMainOrTileHeader(
        result, originalDatabin, databinOffsetInResult, level) {
        
        modifyProgressionOrder(result, originalDatabin, databinOffsetInResult);
        
        if (level === undefined) {
            return 0;
        }
        
        var bestResolutionLevelsRanges =
            offsetsCalculator.getRangesOfBestResolutionLevelsData(
                originalDatabin, level);
        
        if (bestResolutionLevelsRanges.numDecompositionLevelsOffset !== null) {
            var offset =
                databinOffsetInResult +
                bestResolutionLevelsRanges.numDecompositionLevelsOffset;
                
            result[offset] -= level;
        }
        
        var bytesRemoved = removeRanges(
            result, bestResolutionLevelsRanges.ranges, databinOffsetInResult);
        
        var bytesAdded = -bytesRemoved;
        return bytesAdded;
    };
    
    this.modifyImageSize = function modifyImageSize(result, codestreamPartParams) {
        var newTileWidth = codestreamStructure.getTileWidth(
            codestreamPartParams.level);
        var newTileHeight = codestreamStructure.getTileHeight(
            codestreamPartParams.level);
        
        var newReferenceGridSize = codestreamStructure.getSizeOfPart(
            codestreamPartParams);
        
        var sizMarkerOffset = offsetsCalculator.getImageAndTileSizeOffset();
            
        var referenceGridSizeOffset =
            sizMarkerOffset + jGlobals.j2kOffsets.REFERENCE_GRID_SIZE_OFFSET_AFTER_SIZ_MARKER;

        var imageOffsetBytesOffset = referenceGridSizeOffset + 8;
        var tileSizeBytesOffset = referenceGridSizeOffset + 16;
        var firstTileOffsetBytesOffset = referenceGridSizeOffset + 24;
        
        modifyInt32(result, referenceGridSizeOffset, newReferenceGridSize.width);
        modifyInt32(result, referenceGridSizeOffset + 4, newReferenceGridSize.height);
        
        modifyInt32(result, tileSizeBytesOffset, newTileWidth);
        modifyInt32(result, tileSizeBytesOffset + 4, newTileHeight);
        
        modifyInt32(result, imageOffsetBytesOffset, 0);
        modifyInt32(result, imageOffsetBytesOffset + 4, 0);
                
        modifyInt32(result, firstTileOffsetBytesOffset, 0);
        modifyInt32(result, firstTileOffsetBytesOffset + 4, 0);
    };
    
    this.modifyInt32 = modifyInt32;
    
    function modifyProgressionOrder(result, originalDatabin, databinOffsetInResult) {
        var codingStyleOffset = offsetsCalculator.getCodingStyleOffset(originalDatabin);
        
        if (codingStyleOffset !== null) {
            var progressionOrderOffset =
                databinOffsetInResult + codingStyleOffset + 5;
            
            result[progressionOrderOffset] = encodedProgressionOrder;
        }
    }
    
    function removeRanges(result, rangesToRemove, addOffset) {
        if (rangesToRemove.length === 0) {
            return 0; // zero bytes removed
        }
        
        for (var i = 0; i < rangesToRemove.length; ++i) {
            var offset =
                addOffset +
                rangesToRemove[i].markerSegmentLengthOffset;
                
            var originalMarkerSegmentLength =
                (result[offset] << 8) + result[offset + 1];
            
            var newMarkerSegmentLength =
                originalMarkerSegmentLength - rangesToRemove[i].length;
            
            result[offset] = newMarkerSegmentLength >>> 8;
            result[offset + 1] = newMarkerSegmentLength & 0xFF;
        }
        
        var offsetTarget = addOffset + rangesToRemove[0].start;
        var offsetSource = offsetTarget;
        for (var j = 0; j < rangesToRemove.length; ++j) {
            offsetSource += rangesToRemove[j].length;
            
            var nextRangeOffset =
                j + 1 < rangesToRemove.length ?
                    addOffset + rangesToRemove[j + 1].start :
                    result.length;

            for (; offsetSource < nextRangeOffset; ++offsetSource) {
                result[offsetTarget] = result[offsetSource];
                ++offsetTarget;
            }
        }
        
        var bytesRemoved = offsetSource - offsetTarget;
        
        return bytesRemoved;
    }

    function modifyInt32(bytes, offset, newValue) {
        bytes[offset++] = newValue >>> 24;
        bytes[offset++] = (newValue >>> 16) & 0xFF;
        bytes[offset++] = (newValue >>> 8) & 0xFF;
        bytes[offset++] = newValue & 0xFF;
    }

    function encodeProgressionOrder(progressionOrder) {
        // A.6.1
        
        // Table A.16
        
        switch (progressionOrder) {
            case 'LRCP':
                return 0;
                
            case 'RLCP':
                return 1;
                
            case 'RPCL':
                return 2;
            
            case 'PCRL':
                return 3;
                
            case 'CPRL':
                return 4;
            
            default:
                throw new jGlobals.j2kExceptions.IllegalDataException('Progression order of ' + progressionOrder, 'A.6.1, table A.16');
        }
    }
};
},{"j2k-jpip-globals.js":16}],39:[function(require,module,exports){
'use strict';

var jGlobals = require('j2k-jpip-globals.js');

module.exports = function JpipPacketsDataCollector(
    codestreamStructure,
    databinsSaver,
    qualityLayersCache,
    jpipFactory) {
    
    this.getAllCodeblocksData = function getCodeblocksData(
        codestreamPartParams, minNumQualityLayers) {
        
        var alreadyReturnedCodeblocks = jpipFactory.createObjectPoolByDatabin();
        var codeblocksData = getNewCodeblocksDataAndUpdateReturnedCodeblocks(
            codestreamPartParams, minNumQualityLayers, alreadyReturnedCodeblocks);
        
        return {
            codeblocksData: codeblocksData,
            alreadyReturnedCodeblocks: alreadyReturnedCodeblocks
            };
    };
    
    this.getNewCodeblocksDataAndUpdateReturnedCodeblocks =
        getNewCodeblocksDataAndUpdateReturnedCodeblocks;
        
    function getNewCodeblocksDataAndUpdateReturnedCodeblocks(
        codestreamPartParams, minNumQualityLayers, alreadyReturnedCodeblocks) {
        
        var tileIterator = codestreamStructure.getTilesIterator(
            codestreamPartParams);
        
        var tileIndexInCodestreamPart = 0;
        var dummyOffset = 0;
        var result = {
            packetDataOffsets: [],
            data: jpipFactory.createCompositeArray(dummyOffset),
            allRelevantBytesLoaded: 0
            };
        
        do {
            var tileStructure = codestreamStructure.getTileStructure(
                tileIterator.tileIndex);
            
            var precinctIterator = tileStructure.getPrecinctIterator(
                tileIterator.tileIndex, codestreamPartParams);
            
            var quality = tileStructure.getNumQualityLayers();
            
            if (codestreamPartParams.quality !== undefined) {
                quality = Math.min(
                    quality, codestreamPartParams.quality);
            }
            
            if (minNumQualityLayers === 'max') {
                minNumQualityLayers = quality;
            } else if (minNumQualityLayers > quality) {
                throw new jGlobals.jpipExceptions.InternalErrorException(
                    'minNumQualityLayers is larger than quality');
            }
            
            do {
                if (!precinctIterator.isInCodestreamPart) {
                    throw new jGlobals.jpipExceptions.InternalErrorException(
                        'Unexpected precinct not in codestream part');
                }
                
                var inClassIndex = tileStructure.precinctPositionToInClassIndex(
                    precinctIterator);
                    
                var precinctDatabin = databinsSaver.getPrecinctDatabin(
                    inClassIndex);
                
                var returnedInPrecinct =
                    alreadyReturnedCodeblocks.getObject(precinctDatabin);
                if (returnedInPrecinct.layerPerCodeblock === undefined) {
                    returnedInPrecinct.layerPerCodeblock = [];
                }
            
                var layerReached = pushPackets(
                    result,
                    tileIndexInCodestreamPart,
                    precinctIterator,
                    precinctDatabin,
                    returnedInPrecinct,
                    quality);
                
                if (layerReached < minNumQualityLayers) {
                    // NOTE: alreadyReturnedCodeblocks is wrong in this stage,
                    // because it was updated with a data which will not be
                    // returned. I don't care about it now because returning
                    // null here means something bad happened (an exception is
                    // thrown in RequestContext when this happens).
                    // If some day the consistency of alreadyReturnedCodeblocks
                    // is important then a new object should be returned on each
                    // call to this function, or a transactional style should be
                    // used here to abort all non-returned data.
                    
                    return null;
                }
            } while (precinctIterator.tryAdvance());
            
            ++tileIndexInCodestreamPart;
        } while (tileIterator.tryAdvance());
        
        var dataAsUint8 = new Uint8Array(result.data.getLength());
        result.data.copyToTypedArray(dataAsUint8, 0, 0, result.data.getLength());
        result.data = dataAsUint8;
        
        return result;
    }

    function pushPackets(
        result,
        tileIndexInCodestreamPart,
        precinctIterator,
        precinctDatabin,
        returnedCodeblocksInPrecinct,
        quality) {
        
        var layer;
        var offsetInPrecinctDatabin;
        
        for (layer = 0; layer < quality; ++layer) {
            var codeblockOffsetsInDatabin =
                qualityLayersCache.getPacketOffsetsByCodeblockIndex(
                    precinctDatabin, layer, precinctIterator);
            
            if (codeblockOffsetsInDatabin === null) {
                break;
            }
            
            offsetInPrecinctDatabin =
                codeblockOffsetsInDatabin.headerStartOffset +
                codeblockOffsetsInDatabin.headerLength;
            
            var numCodeblocks =
                codeblockOffsetsInDatabin.codeblockBodyLengthByIndex.length;
            var codeblockOffsetsInResult = new Array(numCodeblocks);
            
            var isIncompletePacket = false;
            
            for (var i = 0; i < numCodeblocks; ++i) {
                var returned = returnedCodeblocksInPrecinct.layerPerCodeblock[i];
                if (returned === undefined) {
                    returned = { layer: -1 };
                    returnedCodeblocksInPrecinct.layerPerCodeblock[i] = returned;
                } else if (returned.layer >= layer) {
                    continue;
                }
                
                var codeblock =
                    codeblockOffsetsInDatabin.codeblockBodyLengthByIndex[i];
                
                var offsetInResultArray = result.data.getLength();
                
                var bytesCopied = precinctDatabin.copyToCompositeArray(
                    result.data,
                    {
                        databinStartOffset: offsetInPrecinctDatabin,
                        maxLengthToCopy: codeblock.codeblockBodyLengthBytes,
                        forceCopyAllRange: true
                    });
                
                if (bytesCopied !== codeblock.codeblockBodyLengthBytes) {
                    codeblockOffsetsInResult.length = i;
                    isIncompletePacket = true;
                    break;
                }
                
                returned.layer = layer;
                codeblockOffsetsInResult[i] = {
                    start: offsetInResultArray,
                    end: offsetInResultArray + codeblock.codeblockBodyLengthBytes,
                    codingpasses: codeblock.codingPasses,
                    zeroBitPlanes: codeblock.zeroBitPlanes
                    };
                
                offsetInPrecinctDatabin += codeblock.codeblockBodyLengthBytes;
            }
            
            var packet = {
                tileIndex: tileIndexInCodestreamPart,
                r: precinctIterator.resolutionLevel,
                p: precinctIterator.precinctIndexInComponentResolution,
                c: precinctIterator.component,
                l: layer,
                codeblockOffsets: codeblockOffsetsInResult
                };

            result.packetDataOffsets.push(packet);
            
            if (isIncompletePacket) {
                break;
            }
        }
        
        result.allRelevantBytesLoaded += offsetInPrecinctDatabin;
        return layer;
    }    
};
},{"j2k-jpip-globals.js":16}]},{},[36])(36)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBpL2pwaXAtZmV0Y2guanMiLCJzcmMvYXBpL2pwaXAtZmV0Y2hlci5qcyIsInNyYy9hcGkvanBpcC1pbWFnZS1kYXRhLWNvbnRleHQuanMiLCJzcmMvYXBpL2pwaXAtaW1hZ2UuanMiLCJzcmMvYXBpL2pwaXAtbGV2ZWwtY2FsY3VsYXRvci5qcyIsInNyYy9hcGkvcGRmanMtanB4LWRlY29kZXIuanMiLCJzcmMvZGF0YWJpbnMvY29tcG9zaXRlLWFycmF5LmpzIiwic3JjL2RhdGFiaW5zL2pwaXAtZGF0YWJpbi1wYXJ0cy5qcyIsInNyYy9kYXRhYmlucy9qcGlwLWRhdGFiaW5zLXNhdmVyLmpzIiwic3JjL2RhdGFiaW5zL2pwaXAtb2JqZWN0LXBvb2wtYnktZGF0YWJpbi5qcyIsInNyYy9kYXRhYmlucy9qcGlwLXJlcXVlc3QtZGF0YWJpbnMtbGlzdGVuZXIuanMiLCJzcmMvaW1hZ2Utc3RydWN0dXJlcy9qcGlwLWNvZGVzdHJlYW0tc3RydWN0dXJlLmpzIiwic3JjL2ltYWdlLXN0cnVjdHVyZXMvanBpcC1jb21wb25lbnQtc3RydWN0dXJlLmpzIiwic3JjL2ltYWdlLXN0cnVjdHVyZXMvanBpcC1yZXF1ZXN0LXBhcmFtcy1tb2RpZmllci5qcyIsInNyYy9pbWFnZS1zdHJ1Y3R1cmVzL2pwaXAtdGlsZS1zdHJ1Y3R1cmUuanMiLCJzcmMvbWlzYy9qMmstanBpcC1nbG9iYWxzLmpzIiwic3JjL21pc2MvanBpcC1ydW50aW1lLWZhY3RvcnkuanMiLCJzcmMvbWlzYy9zaW1wbGUtYWpheC1oZWxwZXIuanMiLCJzcmMvcGFyc2Vycy9qcGlwLW1hcmtlcnMtcGFyc2VyLmpzIiwic3JjL3BhcnNlcnMvanBpcC1vZmZzZXRzLWNhbGN1bGF0b3IuanMiLCJzcmMvcGFyc2Vycy9qcGlwLXN0cnVjdHVyZS1wYXJzZXIuanMiLCJzcmMvcHJvdG9jb2wvanBpcC1jaGFubmVsLmpzIiwic3JjL3Byb3RvY29sL2pwaXAtbWVzc2FnZS1oZWFkZXItcGFyc2VyLmpzIiwic3JjL3Byb3RvY29sL2pwaXAtcmVjb25uZWN0YWJsZS1yZXF1ZXN0ZXIuanMiLCJzcmMvcHJvdG9jb2wvanBpcC1yZXF1ZXN0LmpzIiwic3JjL3Byb3RvY29sL2pwaXAtc2Vzc2lvbi1oZWxwZXIuanMiLCJzcmMvcHJvdG9jb2wvanBpcC1zZXNzaW9uLmpzIiwic3JjL3F1YWxpdHktbGF5ZXJzL2pwaXAtYml0c3RyZWFtLXJlYWRlci5qcyIsInNyYy9xdWFsaXR5LWxheWVycy9qcGlwLWNvZGVibG9jay1sZW5ndGgtcGFyc2VyLmpzIiwic3JjL3F1YWxpdHktbGF5ZXJzL2pwaXAtY29kaW5nLXBhc3Nlcy1udW1iZXItcGFyc2VyLmpzIiwic3JjL3F1YWxpdHktbGF5ZXJzL2pwaXAtcGFja2V0LWxlbmd0aC1jYWxjdWxhdG9yLmpzIiwic3JjL3F1YWxpdHktbGF5ZXJzL2pwaXAtcXVhbGl0eS1sYXllcnMtY2FjaGUuanMiLCJzcmMvcXVhbGl0eS1sYXllcnMvanBpcC1zdWJiYW5kLWxlbmd0aC1pbi1wYWNrZXQtaGVhZGVyLWNhbGN1bGF0b3IuanMiLCJzcmMvcXVhbGl0eS1sYXllcnMvanBpcC10YWctdHJlZS5qcyIsInNyYy9xdWFsaXR5LWxheWVycy9tdXR1YWwtZXhjbHVzaXZlLXRyYW5zYWN0aW9uLWhlbHBlci5qcyIsInNyYy93ZWJqcGlwLWV4cG9ydHMuanMiLCJzcmMvd3JpdGVycy9qcGlwLWNvZGVzdHJlYW0tcmVjb25zdHJ1Y3Rvci5qcyIsInNyYy93cml0ZXJzL2pwaXAtaGVhZGVyLW1vZGlmaWVyLmpzIiwic3JjL3dyaXRlcnMvanBpcC1wYWNrZXRzLWRhdGEtY29sbGVjdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4a0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEpwaXBGZXRjaDtcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbmZ1bmN0aW9uIEpwaXBGZXRjaChmZXRjaENvbnRleHQsIHJlcXVlc3RlciwgcHJvZ3Jlc3NpdmVuZXNzKSB7XHJcbiAgICB2YXIgY29kZXN0cmVhbVBhcnRQYXJhbXMgPSBudWxsO1xyXG4gICAgdmFyIGRlZGljYXRlZENoYW5uZWxIYW5kbGUgPSBudWxsO1xyXG4gICAgdmFyIHNlcnZlclJlcXVlc3QgPSBudWxsO1xyXG4gICAgdmFyIGlzRmFpbHVyZSA9IGZhbHNlO1xyXG4gICAgdmFyIGlzVGVybWluYXRlZCA9IGZhbHNlO1xyXG4gICAgdmFyIGlzUHJvZ3Jlc3NpdmUgPSBmYWxzZTtcclxuICAgIC8vdmFyIGlzRG9uZSA9IGZhbHNlO1xyXG4gICAgdmFyIHJlcXVlc3RlZFByb2dyZXNzaXZlU3RhZ2UgPSAwO1xyXG4gICAgLy92YXIgcmVhY2hlZFF1YWxpdHlMYXllciA9IDA7XHJcbiAgICB2YXIgbmV4dFByb2dyZXNzaXZlU3RhZ2UgPSAwO1xyXG4gICAgXHJcbiAgICB0aGlzLnNldERlZGljYXRlZENoYW5uZWxIYW5kbGUgPSBmdW5jdGlvbiBzZXREZWRpY2F0ZWRDaGFubmVsSGFuZGxlKFxyXG4gICAgICAgIGRlZGljYXRlZENoYW5uZWxIYW5kbGVfKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSA9IGRlZGljYXRlZENoYW5uZWxIYW5kbGVfO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5tb3ZlID0gZnVuY3Rpb24gbW92ZShjb2Rlc3RyZWFtUGFydFBhcmFtc18pIHtcclxuICAgICAgICBpZiAoZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSA9PT0gbnVsbCAmJiBjb2Rlc3RyZWFtUGFydFBhcmFtcyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDYW5ub3QgbW92ZSBub24gbW92YWJsZSBmZXRjaCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcyA9IGNvZGVzdHJlYW1QYXJ0UGFyYW1zXztcclxuICAgICAgICByZXF1ZXN0RGF0YSgpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5yZXN1bWUgPSBmdW5jdGlvbiByZXN1bWUoKSB7XHJcbiAgICAgICAgcmVxdWVzdERhdGEoKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc3RvcCA9IGZ1bmN0aW9uIHN0b3AoKSB7XHJcbiAgICAgICAgaWYgKHNlcnZlclJlcXVlc3QgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgaWYgKGlzVGVybWluYXRlZC8qIHx8IGlzRG9uZSovKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ0Nhbm5vdCBzdG9wIGFscmVhZHkgdGVybWluYXRlZCBmZXRjaCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ0Nhbm5vdCBzdG9wIGFscmVhZHkgc3RvcHBlZCBmZXRjaCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoIWRlZGljYXRlZENoYW5uZWxIYW5kbGUpIHtcclxuICAgICAgICAgICAgcmVxdWVzdGVyLnN0b3BSZXF1ZXN0QXN5bmMoc2VydmVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgIHNlcnZlclJlcXVlc3QgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBOT1RFOiBTZW5kIGEgc3RvcCByZXF1ZXN0IHdpdGhpbiBKcGlwUmVxdWVzdCBhbmQgcmVzb2x2ZSB0aGUgUHJvbWlzZVxyXG4gICAgICAgIC8vIG9ubHkgYWZ0ZXIgc2VydmVyIHJlc3BvbnNlIChUaGlzIGlzIG9ubHkgcGVyZm9ybWFuY2UgaXNzdWUsIG5vXHJcbiAgICAgICAgLy8gZnVuY3Rpb25hbCBwcm9ibGVtOiBhIG5ldyBmZXRjaCB3aWxsIHRyaWdnZXIgYSBKUElQIHJlcXVlc3Qgd2l0aFxyXG4gICAgICAgIC8vIHdhaXQ9bm8sIGFuZCB0aGUgb2xkIHJlcXVlc3Qgd2lsbCBiZSBhY3R1YWxseSBzdG9wcGVkKS5cclxuICAgICAgICByZXR1cm4gZmV0Y2hDb250ZXh0LnN0b3BwZWQoKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudGVybWluYXRlID0gZnVuY3Rpb24gdGVybWluYXRlKCkge1xyXG4gICAgICAgIGlmIChkZWRpY2F0ZWRDaGFubmVsSGFuZGxlKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgdGVybWluYXRlIGV2ZW50IG9uIG1vdmFibGUgZmV0Y2gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGlzVGVybWluYXRlZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdEb3VibGUgdGVybWluYXRlIGV2ZW50Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHNlcnZlclJlcXVlc3QgPSBudWxsO1xyXG4gICAgICAgIGlzVGVybWluYXRlZCA9IHRydWU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmlzUHJvZ3Jlc3NpdmVDaGFuZ2VkID0gZnVuY3Rpb24gaXNQcm9ncmVzc2l2ZUNoYW5nZWQoaXNQcm9ncmVzc2l2ZV8pIHtcclxuICAgICAgICBpc1Byb2dyZXNzaXZlID0gaXNQcm9ncmVzc2l2ZV87XHJcbiAgICAgICAgaWYgKGRlZGljYXRlZENoYW5uZWxIYW5kbGUgJiYgc2VydmVyUmVxdWVzdCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBzZXJ2ZXJSZXF1ZXN0ID0gbnVsbDtcclxuICAgICAgICAgICAgcmVxdWVzdERhdGEoKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiByZXF1ZXN0RGF0YSgpIHtcclxuICAgICAgICBpZiAobmV4dFByb2dyZXNzaXZlU3RhZ2UgPj0gcHJvZ3Jlc3NpdmVuZXNzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdVbmV4cGVjdGVkIHJlcXVlc3REYXRhKCkgYWZ0ZXIgZmV0Y2ggZG9uZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoc2VydmVyUmVxdWVzdCAhPT0gbnVsbCAmJiBkZWRpY2F0ZWRDaGFubmVsSGFuZGxlID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ0Nhbm5vdCByZXN1bWUgYWxyZWFkeS1hY3RpdmUtZmV0Y2gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGlzVGVybWluYXRlZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDYW5ub3QgcmVzdW1lIGFscmVhZHktdGVybWluYXRlZC1mZXRjaCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKG5leHRQcm9ncmVzc2l2ZVN0YWdlID49IHByb2dyZXNzaXZlbmVzcy5sZW5ndGggfHxcclxuICAgICAgICAgICAgICAgIHNlcnZlclJlcXVlc3QgIT09IG51bGwgfHxcclxuICAgICAgICAgICAgICAgIGlzVGVybWluYXRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvL2lmIChpc0RvbmUpIHtcclxuICAgICAgICAgICAgLy8gICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAvL31cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJlcXVlc3RlZFByb2dyZXNzaXZlU3RhZ2UgPVxyXG4gICAgICAgICAgICAgICAgaXNQcm9ncmVzc2l2ZSA/IG5leHRQcm9ncmVzc2l2ZVN0YWdlIDogcHJvZ3Jlc3NpdmVuZXNzLmxlbmd0aCAtIDE7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgc2VydmVyUmVxdWVzdCA9IHJlcXVlc3Rlci5yZXF1ZXN0RGF0YShcclxuICAgICAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgICAgICAgICAgcmVxdWVzdGVyQ2FsbGJhY2tPbkFsbERhdGFSZWNpZXZlZCxcclxuICAgICAgICAgICAgICAgIHJlcXVlc3RlckNhbGxiYWNrT25GYWlsdXJlLFxyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NpdmVuZXNzW3JlcXVlc3RlZFByb2dyZXNzaXZlU3RhZ2VdLm1pbk51bVF1YWxpdHlMYXllcnMsXHJcbiAgICAgICAgICAgICAgICBkZWRpY2F0ZWRDaGFubmVsSGFuZGxlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZXF1ZXN0ZXJDYWxsYmFja09uQWxsRGF0YVJlY2lldmVkKHJlcXVlc3QsIGlzUmVzcG9uc2VEb25lKSB7XHJcbiAgICAgICAgc2VydmVyUmVxdWVzdCA9IG51bGw7XHJcbiAgICAgICAgaWYgKCFpc1Jlc3BvbnNlRG9uZSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vaWYgKGlzVGVybWluYXRlZCAmJiByZXF1ZXN0ZWRRdWFsaXR5TGF5ZXIgPiByZWFjaGVkUXVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgLy8gICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxEYXRhRXhjZXB0aW9uKFxyXG4gICAgICAgIC8vICAgICAgICAnSlBJUCBzZXJ2ZXIgbm90IHJldHVybmVkIGFsbCBkYXRhJywgJ0QuMycpO1xyXG4gICAgICAgIC8vfVxyXG4gICAgICAgIG5leHRQcm9ncmVzc2l2ZVN0YWdlID0gcmVxdWVzdGVkUHJvZ3Jlc3NpdmVTdGFnZTtcclxuICAgICAgICBpZiAobmV4dFByb2dyZXNzaXZlU3RhZ2UgPj0gcHJvZ3Jlc3NpdmVuZXNzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBmZXRjaENvbnRleHQuZG9uZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gcmVxdWVzdGVyQ2FsbGJhY2tPbkZhaWx1cmUoKSB7XHJcbiAgICAgICAgLy91cGRhdGVTdGF0dXMoU1RBVFVTX0VOREVELCAnZW5kQXN5bmMoKScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vaWYgKGZhaWx1cmVDYWxsYmFjayAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgLy8gICAgZmFpbHVyZUNhbGxiYWNrKHNlbGYsIHVzZXJDb250ZXh0VmFycyk7XHJcbiAgICAgICAgLy99IGVsc2Uge1xyXG4gICAgICAgIC8vICAgIGlzRmFpbHVyZSA9IHRydWU7XHJcbiAgICAgICAgLy99XHJcbiAgICAgICAgaXNGYWlsdXJlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgLy9pZiAoaXNNb3ZlZCkge1xyXG4gICAgICAgIC8vICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgIC8vICAgICAgICAnRmFpbHVyZSBjYWxsYmFjayB0byBhbiBvbGQgZmV0Y2ggd2hpY2ggaGFzIGJlZW4gYWxyZWFkeSBtb3ZlZCcpO1xyXG4gICAgICAgIC8vfVxyXG4gICAgfTtcclxufVxyXG5cclxuLy9mdW5jdGlvbiBKcGlwRmV0Y2hIYW5kbGUocmVxdWVzdGVyLCBpbWFnZURhdGFDb250ZXh0LCBkZWRpY2F0ZWRDaGFubmVsSGFuZGxlKSB7XHJcbi8vICAgIHRoaXMuX3JlcXVlc3RlciA9IHJlcXVlc3RlcjtcclxuLy8gICAgdGhpcy5faW1hZ2VEYXRhQ29udGV4dCA9IGltYWdlRGF0YUNvbnRleHQ7XHJcbi8vICAgIHRoaXMuX3NlcnZlclJlcXVlc3QgPSBudWxsO1xyXG4vLyAgICB0aGlzLl9kZWRpY2F0ZWRDaGFubmVsSGFuZGxlID0gZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZTtcclxuLy8gICAgdGhpcy5faXNGYWlsdXJlID0gZmFsc2U7XHJcbi8vICAgIHRoaXMuX2lzTW92ZWQgPSBmYWxzZTtcclxuLy8gICAgdGhpcy5fcmVxdWVzdGVkUXVhbGl0eUxheWVyID0gMDtcclxuLy8gICAgdGhpcy5fcmVhY2hlZFF1YWxpdHlMYXllciA9IDA7XHJcbi8vICAgIHRoaXMuX3JlcXVlc3RlckNhbGxiYWNrT25GYWlsdXJlQm91bmQgPSB0aGlzLl9yZXF1ZXN0ZXJDYWxsYmFja09uRmFpbHVyZS5iaW5kKHRoaXMpO1xyXG4vLyAgICBcclxuLy8gICAgaWYgKGltYWdlRGF0YUNvbnRleHQuaXNEaXNwb3NlZCgpKSB7XHJcbi8vICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuLy8gICAgICAgICAgICAnQ2Fubm90IGluaXRpYWxpemUgSnBpcEZldGNoSGFuZGxlIHdpdGggZGlzcG9zZWQgSW1hZ2VEYXRhQ29udGV4dCcpO1xyXG4vLyAgICB9XHJcbi8vICAgIGltYWdlRGF0YUNvbnRleHQub24oJ2RhdGEnLCB0aGlzLl9vbkRhdGEuYmluZCh0aGlzKSk7XHJcbi8vfVxyXG4vL1xyXG4vL0pwaXBGZXRjaEhhbmRsZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24gcmVzdW1lKCkge1xyXG4vLyAgICBpZiAodGhpcy5fc2VydmVyUmVxdWVzdCAhPT0gbnVsbCkge1xyXG4vLyAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxPcGVyYXRpb25FeGNlcHRpb24oXHJcbi8vICAgICAgICAgICAgJ0Nhbm5vdCByZXN1bWUgYWxyZWFkeS1hY3RpdmUtZmV0Y2gnKTtcclxuLy8gICAgfVxyXG4vLyAgICBcclxuLy8gICAgaWYgKHRoaXMuX2ltYWdlRGF0YUNvbnRleHQuaXNEaXNwb3NlZCgpKSB7XHJcbi8vICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuLy8gICAgICAgICAgICAnQ2Fubm90IGZldGNoIGRhdGEgd2l0aCBkaXNwb3NlZCBpbWFnZURhdGFDb250ZXh0Jyk7XHJcbi8vICAgIH1cclxuLy8gICAgXHJcbi8vICAgIGlmICh0aGlzLl9pc01vdmVkKSB7XHJcbi8vICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuLy8gICAgICAgICAgICAnQ2Fubm90IHJlc3VtZSBtb3ZhYmxlIGZldGNoIHdoaWNoIGhhcyBiZWVuIGFscmVhZHkgbW92ZWQ7IFNob3VsZCcgK1xyXG4vLyAgICAgICAgICAgICcgc3RhcnQgYSBuZXcgZmV0Y2ggd2l0aCBzYW1lIGRlZGljYXRlZENoYW5uZWxIYW5kbGUgaW5zdGVhZCcpO1xyXG4vLyAgICB9XHJcbi8vICAgIFxyXG4vLyAgICB0aGlzLl9yZXF1ZXN0RGF0YSgpO1xyXG4vL307XHJcbi8vXHJcbi8vSnBpcEZldGNoSGFuZGxlLnByb3RvdHlwZS5zdG9wQXN5bmMgPSBmdW5jdGlvbiBzdG9wQXN5bmMoKSB7XHJcbi8vICAgIGlmICh0aGlzLl9zZXJ2ZXJSZXF1ZXN0ID09PSBudWxsKSB7XHJcbi8vICAgICAgICBpZiAodGhpcy5faW1hZ2VEYXRhQ29udGV4dC5pc0Rpc3Bvc2VkKCkgfHwgdGhpcy5faW1hZ2VEYXRhQ29udGV4dC5pc0RvbmUoKSkge1xyXG4vLyAgICAgICAgICAgIHJldHVybjtcclxuLy8gICAgICAgIH1cclxuLy8gICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4vLyAgICAgICAgICAgICdDYW5ub3Qgc3RvcCBhbHJlYWR5IHN0b3BwZWQgZmV0Y2gnKTtcclxuLy8gICAgfVxyXG4vLyAgICBcclxuLy8gICAgaWYgKHRoaXMuX2RlZGljYXRlZENoYW5uZWxIYW5kbGUpIHtcclxuLy8gICAgICAgIHRoaXMuX2lzTW92ZWQgPSB0cnVlO1xyXG4vLyAgICB9IGVsc2Uge1xyXG4vLyAgICAgICAgdGhpcy5fcmVxdWVzdGVyLnN0b3BSZXF1ZXN0QXN5bmModGhpcy5fc2VydmVyUmVxdWVzdCk7XHJcbi8vICAgICAgICB0aGlzLl9zZXJ2ZXJSZXF1ZXN0ID0gbnVsbDtcclxuLy8gICAgfVxyXG4vLyAgICBcclxuLy8gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xyXG4vLyAgICAgICAgLy8gTk9URTogU2VuZCBhIHN0b3AgcmVxdWVzdCB3aXRoaW4gSnBpcFJlcXVlc3QgYW5kIHJlc29sdmUgdGhlIFByb21pc2VcclxuLy8gICAgICAgIC8vIG9ubHkgYWZ0ZXIgc2VydmVyIHJlc3BvbnNlIChUaGlzIGlzIG9ubHkgcGVyZm9ybWFuY2UgaXNzdWUsIG5vXHJcbi8vICAgICAgICAvLyBmdW5jdGlvbmFsIHByb2JsZW06IGEgbmV3IGZldGNoIHdpbGwgdHJpZ2dlciBhIEpQSVAgcmVxdWVzdCB3aXRoXHJcbi8vICAgICAgICAvLyB3YWl0PW5vLCBhbmQgdGhlIG9sZCByZXF1ZXN0IHdpbGwgYmUgYWN0dWFsbHkgc3RvcHBlZCkuXHJcbi8vICAgICAgICByZXNvbHZlKCk7XHJcbi8vICAgIH0pO1xyXG4vL307XHJcbi8vXHJcbi8vSnBpcEZldGNoSGFuZGxlLnByb3RvdHlwZS5fcmVxdWVzdGVyQ2FsbGJhY2tPbkFsbERhdGFSZWNpZXZlZCA9XHJcbi8vICAgIGZ1bmN0aW9uIChyZXF1ZXN0LCBpc1Jlc3BvbnNlRG9uZSwgcmVxdWVzdGVkUXVhbGl0eUxheWVyKSB7XHJcbi8vICAgIFxyXG4vLyAgICBpZiAoaXNSZXNwb25zZURvbmUgJiZcclxuLy8gICAgICAgICF0aGlzLl9pc01vdmVkICYmXHJcbi8vICAgICAgICAhdGhpcy5faW1hZ2VEYXRhQ29udGV4dC5pc0Rpc3Bvc2VkKCkgJiZcclxuLy8gICAgICAgIHJlcXVlc3RlZFF1YWxpdHlMYXllciA+IHRoaXMuX3JlYWNoZWRRdWFsaXR5TGF5ZXIpIHtcclxuLy8gICAgICAgICAgICBcclxuLy8gICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbihcclxuLy8gICAgICAgICAgICAnSlBJUCBzZXJ2ZXIgbm90IHJldHVybmVkIGFsbCBkYXRhJywgJ0QuMycpO1xyXG4vLyAgICB9XHJcbi8vfTtcclxuLy9cclxuLy9KcGlwRmV0Y2hIYW5kbGUucHJvdG90eXBlLl9yZXF1ZXN0ZXJDYWxsYmFja09uRmFpbHVyZSA9XHJcbi8vICAgIGZ1bmN0aW9uIHJlcXVlc3RlckNhbGxiYWNrT25GYWlsdXJlKCkge1xyXG4vLyAgICAgICAgXHJcbi8vICAgIC8vdXBkYXRlU3RhdHVzKFNUQVRVU19FTkRFRCwgJ2VuZEFzeW5jKCknKTtcclxuLy8gICAgXHJcbi8vICAgIC8vaWYgKGZhaWx1cmVDYWxsYmFjayAhPT0gdW5kZWZpbmVkKSB7XHJcbi8vICAgIC8vICAgIGZhaWx1cmVDYWxsYmFjayhzZWxmLCB1c2VyQ29udGV4dFZhcnMpO1xyXG4vLyAgICAvL30gZWxzZSB7XHJcbi8vICAgIC8vICAgIGlzRmFpbHVyZSA9IHRydWU7XHJcbi8vICAgIC8vfVxyXG4vLyAgICB0aGlzLl9pc0ZhaWx1cmUgPSB0cnVlO1xyXG4vL1xyXG4vLyAgICBpZiAodGhpcy5faXNNb3ZlZCkge1xyXG4vLyAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbi8vICAgICAgICAgICAgJ0ZhaWx1cmUgY2FsbGJhY2sgdG8gYW4gb2xkIGZldGNoIHdoaWNoIGhhcyBiZWVuIGFscmVhZHkgbW92ZWQnKTtcclxuLy8gICAgfVxyXG4vL307XHJcbi8vXHJcbi8vSnBpcEZldGNoSGFuZGxlLnByb3RvdHlwZS5fb25EYXRhID0gZnVuY3Rpb24gb25EYXRhKGltYWdlRGF0YUNvbnRleHQpIHtcclxuLy8gICAgdGhpcy5fcmVhY2hlZFF1YWxpdHlMYXllciA9IHRoaXMuX3JlcXVlc3RlZFF1YWxpdHlMYXllcjtcclxuLy8gICAgXHJcbi8vICAgIGlmIChpbWFnZURhdGFDb250ZXh0ICE9PSB0aGlzLl9pbWFnZURhdGFDb250ZXh0KSB7XHJcbi8vICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuLy8gICAgICAgICAgICAnVW5leHBlY3RlZCBJbWFnZURhdGFDb250ZXh0IGluIEZldGNoSGFuZGxlIGV2ZW50Jyk7XHJcbi8vICAgIH1cclxuLy8gICAgXHJcbi8vICAgIGlmICghdGhpcy5faXNNb3ZlZCAmJlxyXG4vLyAgICAgICAgIXRoaXMuX2ltYWdlRGF0YUNvbnRleHQuaXNEaXNwb3NlZCgpICYmXHJcbi8vICAgICAgICB0aGlzLl9zZXJ2ZXJSZXF1ZXN0ICE9PSBudWxsKSB7XHJcbi8vICAgICAgICBcclxuLy8gICAgICAgIHRoaXMuX3JlcXVlc3REYXRhKCk7XHJcbi8vICAgIH1cclxuLy99O1xyXG4vL1xyXG4vL0pwaXBGZXRjaEhhbmRsZS5wcm90b3R5cGUuX3JlcXVlc3REYXRhID0gZnVuY3Rpb24gcmVxdWVzdERhdGEoKSB7XHJcbi8vICAgIGlmICh0aGlzLl9pbWFnZURhdGFDb250ZXh0LmlzRG9uZSgpKSB7XHJcbi8vICAgICAgICByZXR1cm47XHJcbi8vICAgIH1cclxuLy8gICAgXHJcbi8vICAgIHZhciBzZWxmID0gdGhpcztcclxuLy8gICAgdmFyIG51bVF1YWxpdHlMYXllcnNUb1dhaXQgPSB0aGlzLl9pbWFnZURhdGFDb250ZXh0LmdldE5leHRRdWFsaXR5TGF5ZXIoKTtcclxuLy8gICAgdGhpcy5fcmVxdWVzdGVkUXVhbGl0eUxheWVyID0gbnVtUXVhbGl0eUxheWVyc1RvV2FpdDtcclxuLy8gICAgICAgIFxyXG4vLyAgICB0aGlzLl9zZXJ2ZXJSZXF1ZXN0ID0gdGhpcy5fcmVxdWVzdGVyLnJlcXVlc3REYXRhKFxyXG4vLyAgICAgICAgdGhpcy5faW1hZ2VEYXRhQ29udGV4dC5nZXRDb2Rlc3RyZWFtUGFydFBhcmFtcygpLFxyXG4vLyAgICAgICAgZnVuY3Rpb24gYWxsRGF0YVJlY2lldmVkKHJlcXVlc3QsIGlzUmVzcG9uc2VEb25lKSB7XHJcbi8vICAgICAgICAgICAgc2VsZi5fcmVxdWVzdGVyQ2FsbGJhY2tPbkFsbERhdGFSZWNpZXZlZChcclxuLy8gICAgICAgICAgICAgICAgcmVxdWVzdCwgaXNSZXNwb25zZURvbmUsIG51bVF1YWxpdHlMYXllcnNUb1dhaXQpO1xyXG4vLyAgICAgICAgfSxcclxuLy8gICAgICAgIHRoaXMuX3JlcXVlc3RlckNhbGxiYWNrT25GYWlsdXJlQm91bmQsXHJcbi8vICAgICAgICBudW1RdWFsaXR5TGF5ZXJzVG9XYWl0LFxyXG4vLyAgICAgICAgdGhpcy5fZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSk7XHJcbi8vfTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcbnZhciBqcGlwRmFjdG9yeSA9IHJlcXVpcmUoJ2pwaXAtcnVudGltZS1mYWN0b3J5LmpzJyk7IFxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBKcGlwRmV0Y2hlcjtcclxuXHJcbmZ1bmN0aW9uIEpwaXBGZXRjaGVyKGRhdGFiaW5zU2F2ZXIsIG9wdGlvbnMpIHtcclxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuICAgIHZhciBpc09wZW5DYWxsZWQgPSBmYWxzZTtcclxuICAgIHZhciByZXNvbHZlT3BlbiA9IG51bGw7XHJcbiAgICB2YXIgcmVqZWN0T3BlbiA9IG51bGw7XHJcbiAgICB2YXIgcHJvZ3Jlc3Npb25PcmRlciA9ICdSUENMJztcclxuXHJcbiAgICB2YXIgbWF4Q2hhbm5lbHNJblNlc3Npb24gPSBvcHRpb25zLm1heENoYW5uZWxzSW5TZXNzaW9uIHx8IDE7XHJcbiAgICB2YXIgbWF4UmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VJbkNoYW5uZWwgPVxyXG4gICAgICAgIG9wdGlvbnMubWF4UmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VJbkNoYW5uZWwgfHwgMTtcclxuXHJcbiAgICAvL3ZhciBkYXRhYmluc1NhdmVyID0ganBpcEZhY3RvcnkuY3JlYXRlRGF0YWJpbnNTYXZlcigvKmlzSnBpcFRpbGVwYXJ0U3RyZWFtPSovZmFsc2UpO1xyXG4gICAgdmFyIG1haW5IZWFkZXJEYXRhYmluID0gZGF0YWJpbnNTYXZlci5nZXRNYWluSGVhZGVyRGF0YWJpbigpO1xyXG5cclxuICAgIHZhciBtYXJrZXJzUGFyc2VyID0ganBpcEZhY3RvcnkuY3JlYXRlTWFya2Vyc1BhcnNlcihtYWluSGVhZGVyRGF0YWJpbik7XHJcbiAgICB2YXIgb2Zmc2V0c0NhbGN1bGF0b3IgPSBqcGlwRmFjdG9yeS5jcmVhdGVPZmZzZXRzQ2FsY3VsYXRvcihcclxuICAgICAgICBtYWluSGVhZGVyRGF0YWJpbiwgbWFya2Vyc1BhcnNlcik7XHJcbiAgICB2YXIgc3RydWN0dXJlUGFyc2VyID0ganBpcEZhY3RvcnkuY3JlYXRlU3RydWN0dXJlUGFyc2VyKFxyXG4gICAgICAgIGRhdGFiaW5zU2F2ZXIsIG1hcmtlcnNQYXJzZXIsIG9mZnNldHNDYWxjdWxhdG9yKTtcclxuICAgIHZhciBjb2Rlc3RyZWFtU3RydWN0dXJlID0ganBpcEZhY3RvcnkuY3JlYXRlQ29kZXN0cmVhbVN0cnVjdHVyZShcclxuICAgICAgICBzdHJ1Y3R1cmVQYXJzZXIsIHByb2dyZXNzaW9uT3JkZXIpO1xyXG5cclxuICAgIHZhciByZXF1ZXN0ZXIgPSBqcGlwRmFjdG9yeS5jcmVhdGVSZWNvbm5lY3RhYmxlUmVxdWVzdGVyKFxyXG4gICAgICAgIG1heENoYW5uZWxzSW5TZXNzaW9uLFxyXG4gICAgICAgIG1heFJlcXVlc3RzV2FpdGluZ0ZvclJlc3BvbnNlSW5DaGFubmVsLFxyXG4gICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICAgICAgZGF0YWJpbnNTYXZlcik7XHJcblxyXG4gICAgdmFyIHBhcmFtc01vZGlmaWVyID0ganBpcEZhY3RvcnkuY3JlYXRlUmVxdWVzdFBhcmFtc01vZGlmaWVyKGNvZGVzdHJlYW1TdHJ1Y3R1cmUpO1xyXG5cclxuICAgIHJlcXVlc3Rlci5zZXRTdGF0dXNDYWxsYmFjayhyZXF1ZXN0ZXJTdGF0dXNDYWxsYmFjayk7XHJcbiAgICBcclxuICAgIHRoaXMub3BlbiA9IGZ1bmN0aW9uIG9wZW4oYmFzZVVybCkge1xyXG4gICAgICAgIGlmIChpc09wZW5DYWxsZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgJ3dlYkpwaXAgZXJyb3I6IENhbm5vdCBjYWxsIEpwaXBGZXRjaGVyLm9wZW4oKSB0d2ljZSc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZU9wZW4gPSByZXNvbHZlO1xyXG4gICAgICAgICAgICByZWplY3RPcGVuID0gcmVqZWN0O1xyXG4gICAgICAgICAgICByZXF1ZXN0ZXIub3BlbihiYXNlVXJsKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuY2xvc2UgPSBmdW5jdGlvbiBjbG9zZSgpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIHJlcXVlc3Rlci5jbG9zZShyZXNvbHZlKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMub24gPSBmdW5jdGlvbiBvbigpIHtcclxuICAgICAgICAvLyBUT0RPIFdoZW4gSnBpcEZldGNoZXIgaXMgZnVsbHkgYWxpZ25lZCB0byBpbWFnZURlY29kZXJGcmFtZXdvcmsgbmV3IEFQSVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnN0YXJ0RmV0Y2ggPSBmdW5jdGlvbiBzdGFydEZldGNoKGZldGNoQ29udGV4dCwgY29kZXN0cmVhbVBhcnRQYXJhbXMpIHtcclxuICAgICAgICB2YXIgcGFyYW1zID0gcGFyYW1zTW9kaWZpZXIubW9kaWZ5KGNvZGVzdHJlYW1QYXJ0UGFyYW1zKTtcclxuICAgICAgICB2YXIgZmV0Y2ggPSBjcmVhdGVGZXRjaChmZXRjaENvbnRleHQsIHBhcmFtcy5wcm9ncmVzc2l2ZW5lc3MpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZldGNoLm1vdmUocGFyYW1zLmNvZGVzdHJlYW1QYXJ0UGFyYW1zKTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5zdGFydE1vdmFibGVGZXRjaCA9IGZ1bmN0aW9uIHN0YXJ0TW92YWJsZUZldGNoKGZldGNoQ29udGV4dCwgY29kZXN0cmVhbVBhcnRQYXJhbXMpIHtcclxuICAgICAgICB2YXIgcGFyYW1zID0gcGFyYW1zTW9kaWZpZXIubW9kaWZ5KGNvZGVzdHJlYW1QYXJ0UGFyYW1zKTtcclxuICAgICAgICB2YXIgZmV0Y2ggPSBjcmVhdGVGZXRjaChmZXRjaENvbnRleHQsIHBhcmFtcy5wcm9ncmVzc2l2ZW5lc3MpO1xyXG5cclxuICAgICAgICB2YXIgZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSA9IHJlcXVlc3Rlci5kZWRpY2F0ZUNoYW5uZWxGb3JNb3ZhYmxlUmVxdWVzdCgpO1xyXG4gICAgICAgIGZldGNoLnNldERlZGljYXRlZENoYW5uZWxIYW5kbGUoZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSk7XHJcbiAgICAgICAgZmV0Y2hDb250ZXh0Lm9uKCdtb3ZlJywgZmV0Y2gubW92ZSk7XHJcblxyXG4gICAgICAgIGZldGNoLm1vdmUocGFyYW1zLmNvZGVzdHJlYW1QYXJ0UGFyYW1zKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUZldGNoKGZldGNoQ29udGV4dCwgcHJvZ3Jlc3NpdmVuZXNzKSB7XHJcbiAgICAgICAgLy92YXIgaW1hZ2VEYXRhQ29udGV4dCA9IGpwaXBGYWN0b3J5LmNyZWF0ZUltYWdlRGF0YUNvbnRleHQoXHJcbiAgICAgICAgLy8gICAganBpcE9iamVjdHNGb3JSZXF1ZXN0Q29udGV4dCxcclxuICAgICAgICAvLyAgICBjb2Rlc3RyZWFtUGFydFBhcmFtc01vZGlmaWVkLFxyXG4gICAgICAgIC8vICAgIHByb2dyZXNzaXZlbmVzc01vZGlmaWVkKTtcclxuICAgICAgICAvLyAgICAvL3tcclxuICAgICAgICAvLyAgICAvLyAgICBkaXNhYmxlU2VydmVyUmVxdWVzdHM6ICEhb3B0aW9ucy5pc09ubHlXYWl0Rm9yRGF0YSxcclxuICAgICAgICAvLyAgICAvLyAgICBpc01vdmFibGU6IGZhbHNlLFxyXG4gICAgICAgIC8vICAgIC8vICAgIHVzZXJDb250ZXh0VmFyczogdXNlckNvbnRleHRWYXJzLFxyXG4gICAgICAgIC8vICAgIC8vICAgIGZhaWx1cmVDYWxsYmFjazogb3B0aW9ucy5mYWlsdXJlQ2FsbGJhY2tcclxuICAgICAgICAvLyAgICAvL30pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBmZXRjaCA9IGpwaXBGYWN0b3J5LmNyZWF0ZUZldGNoKGZldGNoQ29udGV4dCwgcmVxdWVzdGVyLCBwcm9ncmVzc2l2ZW5lc3MpO1xyXG5cclxuICAgICAgICBmZXRjaENvbnRleHQub24oJ2lzUHJvZ3Jlc3NpdmVDaGFuZ2VkJywgZmV0Y2guaXNQcm9ncmVzc2l2ZUNoYW5nZWQpO1xyXG4gICAgICAgIGZldGNoQ29udGV4dC5vbigndGVybWluYXRlJywgZmV0Y2gudGVybWluYXRlKTtcclxuICAgICAgICBmZXRjaENvbnRleHQub24oJ3N0b3AnLCBmZXRjaC5zdG9wKTtcclxuICAgICAgICBmZXRjaENvbnRleHQub24oJ3Jlc3VtZScsIGZldGNoLnJlc3VtKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZmV0Y2g7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vdGhpcy5zdGFydE1vdmFibGVGZXRjaCA9IGZ1bmN0aW9uIHN0YXJ0TW92YWJsZUZldGNoKGltYWdlRGF0YUNvbnRleHQsIG1vdmFibGVGZXRjaFN0YXRlKSB7XHJcbiAgICAvLyAgICBtb3ZhYmxlRmV0Y2hTdGF0ZS5kZWRpY2F0ZWRDaGFubmVsSGFuZGxlID1cclxuICAgIC8vICAgICAgICByZXF1ZXN0ZXIuZGVkaWNhdGVDaGFubmVsRm9yTW92YWJsZVJlcXVlc3QoKTtcclxuICAgIC8vICAgIG1vdmFibGVGZXRjaFN0YXRlLmZldGNoSGFuZGxlID0ganBpcEZhY3RvcnkuY3JlYXRlRmV0Y2hIYW5kbGUoXHJcbiAgICAvLyAgICAgICAgcmVxdWVzdGVyLCBpbWFnZURhdGFDb250ZXh0LCBtb3ZhYmxlRmV0Y2hTdGF0ZS5kZWRpY2F0ZWRDaGFubmVsSGFuZGxlKTtcclxuICAgIC8vICAgIG1vdmFibGVGZXRjaFN0YXRlLmZldGNoSGFuZGxlLnJlc3VtZSgpO1xyXG4gICAgLy99O1xyXG4gICAgLy9cclxuICAgIC8vdGhpcy5tb3ZlRmV0Y2ggPSBmdW5jdGlvbiBtb3ZlRmV0Y2goaW1hZ2VEYXRhQ29udGV4dCwgbW92YWJsZUZldGNoU3RhdGUpIHtcclxuICAgIC8vICAgIG1vdmFibGVGZXRjaFN0YXRlLmZldGNoSGFuZGxlLnN0b3BBc3luYygpO1xyXG4gICAgLy8gICAgbW92YWJsZUZldGNoU3RhdGUuZmV0Y2hIYW5kbGUgPSBqcGlwRmFjdG9yeS5jcmVhdGVGZXRjaEhhbmRsZShcclxuICAgIC8vICAgICAgICByZXF1ZXN0ZXIsIGltYWdlRGF0YUNvbnRleHQsIG1vdmFibGVGZXRjaFN0YXRlLmRlZGljYXRlZENoYW5uZWxIYW5kbGUpO1xyXG4gICAgLy8gICAgbW92YWJsZUZldGNoU3RhdGUuZmV0Y2hIYW5kbGUucmVzdW1lKCk7XHJcbiAgICAvL307XHJcbiAgICBcclxuICAgIHRoaXMucmVjb25uZWN0ID0gZnVuY3Rpb24gcmVjb25uZWN0KCkge1xyXG4gICAgICAgIHJlcXVlc3Rlci5yZWNvbm5lY3QoKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHJlcXVlc3RlclN0YXR1c0NhbGxiYWNrKHJlcXVlc3RlclN0YXR1cykge1xyXG4gICAgICAgIHZhciBzZXJpYWxpemFibGVFeGNlcHRpb24gPSBudWxsO1xyXG4gICAgICAgIGlmIChyZXF1ZXN0ZXJTdGF0dXMuZXhjZXB0aW9uICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNlcmlhbGl6YWJsZUV4Y2VwdGlvbiA9IHJlcXVlc3RlclN0YXR1cy5leGNlcHRpb24udG9TdHJpbmcoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN0YXR1cyA9IHtcclxuICAgICAgICAgICAgaXNSZWFkeTogcmVxdWVzdGVyU3RhdHVzLmlzUmVhZHksXHJcbiAgICAgICAgICAgIGV4Y2VwdGlvbjogc2VyaWFsaXphYmxlRXhjZXB0aW9uXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFyZXNvbHZlT3BlbiB8fCAoIXN0YXR1cy5pc1JlYWR5ICYmICFzdGF0dXMuZXhjZXB0aW9uKSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsb2NhbFJlc29sdmUgPSByZXNvbHZlT3BlbjtcclxuICAgICAgICB2YXIgbG9jYWxSZWplY3QgPSByZWplY3RPcGVuO1xyXG4gICAgICAgIHJlc29sdmVPcGVuID0gbnVsbDtcclxuICAgICAgICByZWplY3RPcGVuID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKCFzdGF0dXMuaXNSZWFkeSkge1xyXG4gICAgICAgICAgICBsb2NhbFJlamVjdChzdGF0dXMuZXhjZXB0aW9uKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgcGFyYW1zID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRTaXplc1BhcmFtcygpO1xyXG4gICAgICAgIHZhciBjbG9uZWRQYXJhbXMgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHBhcmFtcykpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXREZWZhdWx0VGlsZVN0cnVjdHVyZSgpO1xyXG4gICAgICAgIHZhciBjb21wb25lbnQgPSB0aWxlLmdldERlZmF1bHRDb21wb25lbnRTdHJ1Y3R1cmUoKTtcclxuXHJcbiAgICAgICAgY2xvbmVkUGFyYW1zLmltYWdlTGV2ZWwgPSAwO1xyXG4gICAgICAgIGNsb25lZFBhcmFtcy5sb3dlc3RRdWFsaXR5ID0gMTtcclxuICAgICAgICBjbG9uZWRQYXJhbXMuaGlnaGVzdFF1YWxpdHkgPSB0aWxlLmdldE51bVF1YWxpdHlMYXllcnMoKTtcclxuICAgICAgICBjbG9uZWRQYXJhbXMubnVtUmVzb2x1dGlvbkxldmVsc0ZvckxpbWl0dGVkVmlld2VyID1cclxuICAgICAgICAgICAgY29tcG9uZW50LmdldE51bVJlc29sdXRpb25MZXZlbHMoKTtcclxuICAgICAgICBcclxuICAgICAgICBsb2NhbFJlc29sdmUoY2xvbmVkUGFyYW1zKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn0iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEpwaXBJbWFnZURhdGFDb250ZXh0O1xyXG5cclxuZnVuY3Rpb24gSnBpcEltYWdlRGF0YUNvbnRleHQoanBpcE9iamVjdHMsIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLCBwcm9ncmVzc2l2ZW5lc3MpIHtcclxuICAgIHRoaXMuX2NvZGVzdHJlYW1QYXJ0UGFyYW1zID0gY29kZXN0cmVhbVBhcnRQYXJhbXM7XHJcbiAgICB0aGlzLl9wcm9ncmVzc2l2ZW5lc3MgICAgICA9IHByb2dyZXNzaXZlbmVzcztcclxuICAgIHRoaXMuX3JlY29uc3RydWN0b3IgICAgICAgID0ganBpcE9iamVjdHMucmVjb25zdHJ1Y3RvcjtcclxuICAgIHRoaXMuX3BhY2tldHNEYXRhQ29sbGVjdG9yID0ganBpcE9iamVjdHMucGFja2V0c0RhdGFDb2xsZWN0b3I7XHJcbiAgICB0aGlzLl9xdWFsaXR5TGF5ZXJzQ2FjaGUgICA9IGpwaXBPYmplY3RzLnF1YWxpdHlMYXllcnNDYWNoZTtcclxuICAgIHRoaXMuX2NvZGVzdHJlYW1TdHJ1Y3R1cmUgID0ganBpcE9iamVjdHMuY29kZXN0cmVhbVN0cnVjdHVyZTtcclxuICAgIHRoaXMuX2RhdGFiaW5zU2F2ZXIgICAgICAgID0ganBpcE9iamVjdHMuZGF0YWJpbnNTYXZlcjtcclxuICAgIHRoaXMuX2pwaXBGYWN0b3J5ICAgICAgICAgID0ganBpcE9iamVjdHMuanBpcEZhY3Rvcnk7XHJcblxyXG4gICAgdGhpcy5fcHJvZ3Jlc3NpdmVTdGFnZXNGaW5pc2hlZCA9IDA7XHJcbiAgICB0aGlzLl9xdWFsaXR5TGF5ZXJzUmVhY2hlZCA9IDA7XHJcbiAgICB0aGlzLl9kYXRhTGlzdGVuZXJzID0gW107XHJcbiAgICBcclxuICAgIHRoaXMuX2xpc3RlbmVyID0gdGhpcy5fanBpcEZhY3RvcnkuY3JlYXRlUmVxdWVzdERhdGFiaW5zTGlzdGVuZXIoXHJcbiAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgdGhpcy5fcXVhbGl0eUxheWVyUmVhY2hlZENhbGxiYWNrLmJpbmQodGhpcyksXHJcbiAgICAgICAgdGhpcy5fY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgICAgICB0aGlzLl9kYXRhYmluc1NhdmVyLFxyXG4gICAgICAgIHRoaXMuX3F1YWxpdHlMYXllcnNDYWNoZSk7XHJcbn1cclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5oYXNEYXRhID0gZnVuY3Rpb24gaGFzRGF0YSgpIHtcclxuICAgIC8vZW5zdXJlTm9GYWlsdXJlKCk7XHJcbiAgICB0aGlzLl9lbnN1cmVOb3REaXNwb3NlZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMuX3Byb2dyZXNzaXZlU3RhZ2VzRmluaXNoZWQgPiAwO1xyXG59O1xyXG5cclxuSnBpcEltYWdlRGF0YUNvbnRleHQucHJvdG90eXBlLmdldEZldGNoZWREYXRhID0gZnVuY3Rpb24gZ2V0RmV0Y2hlZERhdGEocXVhbGl0eSkge1xyXG4gICAgdGhpcy5fZW5zdXJlTm90RGlzcG9zZWQoKTtcclxuICAgIGlmICghdGhpcy5oYXNEYXRhKCkpIHtcclxuICAgICAgICB0aHJvdyAnSnBpcEltYWdlRGF0YUNvbnRleHQgZXJyb3I6IGNhbm5vdCBjYWxsIGdldEZldGNoZWREYXRhIGJlZm9yZSBoYXNEYXRhID0gdHJ1ZSc7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vZW5zdXJlTm9GYWlsdXJlKCk7XHJcbiAgICB2YXIgcGFyYW1zID0gdGhpcy5fZ2V0UGFyYW1zRm9yRGF0YVdyaXRlcihxdWFsaXR5KTtcclxuICAgIHZhciBjb2RlYmxvY2tzID0gdGhpcy5fcGFja2V0c0RhdGFDb2xsZWN0b3IuZ2V0QWxsQ29kZWJsb2Nrc0RhdGEoXHJcbiAgICAgICAgcGFyYW1zLmNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgIHBhcmFtcy5taW5OdW1RdWFsaXR5TGF5ZXJzKTtcclxuICAgIFxyXG4gICAgdmFyIGhlYWRlcnNDb2Rlc3RyZWFtID0gdGhpcy5fcmVjb25zdHJ1Y3Rvci5jcmVhdGVDb2Rlc3RyZWFtRm9yUmVnaW9uKFxyXG4gICAgICAgIHBhcmFtcy5jb2Rlc3RyZWFtUGFydFBhcmFtcyxcclxuICAgICAgICBwYXJhbXMubWluTnVtUXVhbGl0eUxheWVycyxcclxuICAgICAgICAvKmlzT25seUhlYWRlcnNXaXRob3V0Qml0c3RyZWFtPSovdHJ1ZSk7XHJcbiAgICBcclxuICAgIGlmIChjb2RlYmxvY2tzLmNvZGVibG9ja3NEYXRhID09PSBudWxsKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICdDb3VsZCBub3QgY29sbGVjdCBjb2RlYmxvY2tzIGFsdGhvdWdoIHByb2dyZXNzaXZlbmVzcyAnICtcclxuICAgICAgICAgICAgJ3N0YWdlIGhhcyBiZWVuIHJlYWNoZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKGhlYWRlcnNDb2Rlc3RyZWFtID09PSBudWxsKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICdDb3VsZCBub3QgcmVjb25zdHJ1Y3QgY29kZXN0cmVhbSBhbHRob3VnaCAnICtcclxuICAgICAgICAgICAgJ3Byb2dyZXNzaXZlbmVzcyBzdGFnZSBoYXMgYmVlbiByZWFjaGVkJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vYWxyZWFkeVJldHVybmVkQ29kZWJsb2NrcyA9IGNvZGVibG9ja3MuYWxyZWFkeVJldHVybmVkQ29kZWJsb2NrcztcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaGVhZGVyc0NvZGVzdHJlYW06IGhlYWRlcnNDb2Rlc3RyZWFtLFxyXG4gICAgICAgIGNvZGVibG9ja3NEYXRhOiBjb2RlYmxvY2tzLmNvZGVibG9ja3NEYXRhLFxyXG4gICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zOiB0aGlzLl9jb2Rlc3RyZWFtUGFydFBhcmFtc1xyXG4gICAgfTtcclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5nZXRGZXRjaGVkRGF0YUFzQ29kZXN0cmVhbSA9IGZ1bmN0aW9uIGdldEZldGNoZWREYXRhQXNDb2Rlc3RyZWFtKHF1YWxpdHkpIHtcclxuICAgIHRoaXMuX2Vuc3VyZU5vdERpc3Bvc2VkKCk7XHJcbiAgICAvL2Vuc3VyZU5vRmFpbHVyZSgpO1xyXG4gICAgXHJcbiAgICB2YXIgcGFyYW1zID0gdGhpcy5fZ2V0UGFyYW1zRm9yRGF0YVdyaXRlcihxdWFsaXR5KTtcclxuICAgIFxyXG4gICAgdmFyIGNvZGVzdHJlYW0gPSB0aGlzLl9yZWNvbnN0cnVjdG9yLmNyZWF0ZUNvZGVzdHJlYW1Gb3JSZWdpb24oXHJcbiAgICAgICAgcGFyYW1zLmNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgIHBhcmFtcy5taW5OdW1RdWFsaXR5TGF5ZXJzKTtcclxuICAgIFxyXG4gICAgaWYgKGNvZGVzdHJlYW0gPT09IG51bGwpIHtcclxuICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgJ0NvdWxkIG5vdCByZWNvbnN0cnVjdCBjb2Rlc3RyZWFtIGFsdGhvdWdoICcgK1xyXG4gICAgICAgICAgICAncHJvZ3Jlc3NpdmVuZXNzIHN0YWdlIGhhcyBiZWVuIHJlYWNoZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGNvZGVzdHJlYW07XHJcbn07XHJcblxyXG5KcGlwSW1hZ2VEYXRhQ29udGV4dC5wcm90b3R5cGUub24gPSBmdW5jdGlvbiBvbihldmVudCwgbGlzdGVuZXIpIHtcclxuICAgIHRoaXMuX2Vuc3VyZU5vdERpc3Bvc2VkKCk7XHJcbiAgICBpZiAoZXZlbnQgIT09ICdkYXRhJykge1xyXG4gICAgICAgIHRocm93ICdKcGlwSW1hZ2VEYXRhQ29udGV4dCBlcnJvcjogVW5leHBlY3RlZCBldmVudCAnICsgZXZlbnQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuX2RhdGFMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XHJcbn07XHJcblxyXG5KcGlwSW1hZ2VEYXRhQ29udGV4dC5wcm90b3R5cGUuaXNEb25lID0gZnVuY3Rpb24gaXNEb25lKCkge1xyXG4gICAgdGhpcy5fZW5zdXJlTm90RGlzcG9zZWQoKTtcclxuICAgIHJldHVybiB0aGlzLl9pc1JlcXVlc3REb25lO1xyXG59O1xyXG5cclxuSnBpcEltYWdlRGF0YUNvbnRleHQucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiBkaXNwb3NlKCkge1xyXG4gICAgdGhpcy5fZW5zdXJlTm90RGlzcG9zZWQoKTtcclxuICAgIHRoaXMuX2xpc3RlbmVyLnVucmVnaXN0ZXIoKTtcclxuICAgIHRoaXMuX2xpc3RlbmVyID0gbnVsbDtcclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5zZXRJc1Byb2dyZXNzaXZlID0gZnVuY3Rpb24gc2V0SXNQcm9ncmVzc2l2ZShpc1Byb2dyZXNzaXZlKSB7XHJcbiAgICB0aGlzLl9lbnN1cmVOb3REaXNwb3NlZCgpO1xyXG4gICAgdmFyIG9sZElzUHJvZ3Jlc3NpdmUgPSB0aGlzLl9pc1Byb2dyZXNzaXZlO1xyXG4gICAgdGhpcy5faXNQcm9ncmVzc2l2ZSA9IGlzUHJvZ3Jlc3NpdmU7XHJcbiAgICBpZiAoIW9sZElzUHJvZ3Jlc3NpdmUgJiYgaXNQcm9ncmVzc2l2ZSAmJiB0aGlzLmhhc0RhdGEoKSkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fZGF0YUxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB0aGlzLl9kYXRhTGlzdGVuZXJzW2ldKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbi8vIE1ldGhvZHMgZm9yIEpwaXBGZXRjaEhhbmRsZVxyXG5cclxuSnBpcEltYWdlRGF0YUNvbnRleHQucHJvdG90eXBlLmlzRGlzcG9zZWQgPSBmdW5jdGlvbiBpc0Rpc3Bvc2VkKCkge1xyXG4gICAgcmV0dXJuICF0aGlzLl9saXN0ZW5lcjtcclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5nZXRDb2Rlc3RyZWFtUGFydFBhcmFtcyA9XHJcbiAgICBmdW5jdGlvbiBnZXRDb2Rlc3RyZWFtUGFydFBhcmFtcygpIHtcclxuICAgICAgICBcclxuICAgIHJldHVybiB0aGlzLl9jb2Rlc3RyZWFtUGFydFBhcmFtcztcclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5nZXROZXh0UXVhbGl0eUxheWVyID1cclxuICAgIGZ1bmN0aW9uIGdldE5leHRRdWFsaXR5TGF5ZXIoKSB7XHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4gdGhpcy5fcHJvZ3Jlc3NpdmVuZXNzW3RoaXMuX3Byb2dyZXNzaXZlU3RhZ2VzRmluaXNoZWRdLm1pbk51bVF1YWxpdHlMYXllcnM7XHJcbn07XHJcblxyXG4vLyBQcml2YXRlIG1ldGhvZHNcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5fdHJ5QWR2YW5jZVByb2dyZXNzaXZlU3RhZ2UgPSBmdW5jdGlvbiB0cnlBZHZhbmNlUHJvZ3Jlc3NpdmVTdGFnZSgpIHtcclxuICAgIHZhciBudW1RdWFsaXR5TGF5ZXJzVG9XYWl0ID0gdGhpcy5fcHJvZ3Jlc3NpdmVuZXNzW1xyXG4gICAgICAgIHRoaXMuX3Byb2dyZXNzaXZlU3RhZ2VzRmluaXNoZWRdLm1pbk51bVF1YWxpdHlMYXllcnM7XHJcblxyXG4gICAgaWYgKHRoaXMuX3F1YWxpdHlMYXllcnNSZWFjaGVkIDwgbnVtUXVhbGl0eUxheWVyc1RvV2FpdCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKHRoaXMuX3F1YWxpdHlMYXllcnNSZWFjaGVkID09PSAnbWF4Jykge1xyXG4gICAgICAgIHRoaXMuX3Byb2dyZXNzaXZlU3RhZ2VzRmluaXNoZWQgPSB0aGlzLl9wcm9ncmVzc2l2ZW5lc3MubGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB3aGlsZSAodGhpcy5fcHJvZ3Jlc3NpdmVTdGFnZXNGaW5pc2hlZCA8IHRoaXMuX3Byb2dyZXNzaXZlbmVzcy5sZW5ndGgpIHtcclxuICAgICAgICB2YXIgcXVhbGl0eUxheWVyc1JlcXVpcmVkID0gdGhpcy5fcHJvZ3Jlc3NpdmVuZXNzW1xyXG4gICAgICAgICAgICB0aGlzLl9wcm9ncmVzc2l2ZVN0YWdlc0ZpbmlzaGVkXS5taW5OdW1RdWFsaXR5TGF5ZXJzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChxdWFsaXR5TGF5ZXJzUmVxdWlyZWQgPT09ICdtYXgnIHx8XHJcbiAgICAgICAgICAgIHF1YWxpdHlMYXllcnNSZXF1aXJlZCA+IHRoaXMuX3F1YWxpdHlMYXllcnNSZWFjaGVkKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgKyt0aGlzLl9wcm9ncmVzc2l2ZVN0YWdlc0ZpbmlzaGVkO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLl9pc1JlcXVlc3REb25lID0gdGhpcy5fcHJvZ3Jlc3NpdmVTdGFnZXNGaW5pc2hlZCA9PT0gdGhpcy5fcHJvZ3Jlc3NpdmVuZXNzLmxlbmd0aDtcclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5fcXVhbGl0eUxheWVyUmVhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24gcXVhbGl0eUxheWVyUmVhY2hlZENhbGxiYWNrKHF1YWxpdHlMYXllcnNSZWFjaGVkKSB7XHJcbiAgICB0aGlzLl9xdWFsaXR5TGF5ZXJzUmVhY2hlZCA9IHF1YWxpdHlMYXllcnNSZWFjaGVkO1xyXG4gICAgXHJcbiAgICBpZiAodGhpcy5faXNSZXF1ZXN0RG9uZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAnUmVxdWVzdCBhbHJlYWR5IGRvbmUgYnV0IGNhbGxiYWNrIGlzIGNhbGxlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAoIXRoaXMuX3RyeUFkdmFuY2VQcm9ncmVzc2l2ZVN0YWdlKCkpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmICghdGhpcy5faXNQcm9ncmVzc2l2ZSAmJiAhdGhpcy5faXNSZXF1ZXN0RG9uZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9kYXRhTGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgdGhpcy5fZGF0YUxpc3RlbmVyc1tpXSh0aGlzKTtcclxuICAgIH1cclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5fZ2V0UGFyYW1zRm9yRGF0YVdyaXRlciA9IGZ1bmN0aW9uIGdldFBhcmFtc0ZvckRhdGFXcml0ZXIocXVhbGl0eSkge1xyXG4gICAgLy9lbnN1cmVOb3RFbmRlZChzdGF0dXMsIC8qYWxsb3dab21iaWU9Ki90cnVlKTtcclxuICAgIFxyXG4gICAgLy9pZiAoY29kZXN0cmVhbVBhcnRQYXJhbXMgPT09IG51bGwpIHtcclxuICAgIC8vICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKCdDYW5ub3QgJyArXHJcbiAgICAvLyAgICAgICAgJ2dldCBkYXRhIG9mIHpvbWJpZSByZXF1ZXN0IHdpdGggbm8gY29kZXN0cmVhbVBhcnRQYXJhbXMnKTtcclxuICAgIC8vfVxyXG4gICAgXHJcbiAgICAvL3ZhciBpc1JlcXVlc3REb25lID0gcHJvZ3Jlc3NpdmVTdGFnZXNGaW5pc2hlZCA9PT0gcHJvZ3Jlc3NpdmVuZXNzLmxlbmd0aDtcclxuICAgIC8vaWYgKCFpc1JlcXVlc3REb25lKSB7XHJcbiAgICAvLyAgICBlbnN1cmVOb3RXYWl0aW5nRm9yVXNlcklucHV0KHN0YXR1cyk7XHJcbiAgICAvL31cclxuICAgIFxyXG4gICAgaWYgKHRoaXMuX3Byb2dyZXNzaXZlU3RhZ2VzRmluaXNoZWQgPT09IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgJ0Nhbm5vdCBjcmVhdGUgY29kZXN0cmVhbSBiZWZvcmUgZmlyc3QgcHJvZ3Jlc3NpdmVuZXNzICcgK1xyXG4gICAgICAgICAgICAnc3RhZ2UgaGFzIGJlZW4gcmVhY2hlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgbWluTnVtUXVhbGl0eUxheWVycyA9XHJcbiAgICAgICAgdGhpcy5fcHJvZ3Jlc3NpdmVuZXNzW3RoaXMuX3Byb2dyZXNzaXZlU3RhZ2VzRmluaXNoZWQgLSAxXS5taW5OdW1RdWFsaXR5TGF5ZXJzO1xyXG4gICAgXHJcbiAgICB2YXIgbmV3UGFyYW1zID0gdGhpcy5fY29kZXN0cmVhbVBhcnRQYXJhbXM7XHJcbiAgICBpZiAocXVhbGl0eSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbmV3UGFyYW1zID0gT2JqZWN0LmNyZWF0ZSh0aGlzLl9jb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcbiAgICAgICAgbmV3UGFyYW1zLnF1YWxpdHkgPSBxdWFsaXR5O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChtaW5OdW1RdWFsaXR5TGF5ZXJzICE9PSAnbWF4Jykge1xyXG4gICAgICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzID0gTWF0aC5taW4oXHJcbiAgICAgICAgICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzLCBxdWFsaXR5KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXM6IG5ld1BhcmFtcyxcclxuICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzOiBtaW5OdW1RdWFsaXR5TGF5ZXJzXHJcbiAgICAgICAgfTtcclxufTtcclxuXHJcbkpwaXBJbWFnZURhdGFDb250ZXh0LnByb3RvdHlwZS5fZW5zdXJlTm90RGlzcG9zZWQgPSBmdW5jdGlvbiBlbnN1cmVOb3REaXNwb3NlZCgpIHtcclxuICAgIGlmICh0aGlzLmlzRGlzcG9zZWQoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKCdDYW5ub3QgdXNlIEltYWdlRGF0YUNvbnRleHQgYWZ0ZXIgZGlzcG9zZWQnKTtcclxuICAgIH1cclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpwaXBGYWN0b3J5ID0gcmVxdWlyZSgnanBpcC1ydW50aW1lLWZhY3RvcnkuanMnKTsgXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEpwaXBJbWFnZTtcclxuXHJcbmZ1bmN0aW9uIEpwaXBJbWFnZShvcHRpb25zKSB7XHJcbiAgICB2YXIgZGF0YWJpbnNTYXZlciA9IGpwaXBGYWN0b3J5LmNyZWF0ZURhdGFiaW5zU2F2ZXIoLyppc0pwaXBUaWxlcGFydFN0cmVhbT0qL2ZhbHNlKTtcclxuICAgIHZhciBtYWluSGVhZGVyRGF0YWJpbiA9IGRhdGFiaW5zU2F2ZXIuZ2V0TWFpbkhlYWRlckRhdGFiaW4oKTtcclxuXHJcbiAgICB2YXIgbWFya2Vyc1BhcnNlciA9IGpwaXBGYWN0b3J5LmNyZWF0ZU1hcmtlcnNQYXJzZXIobWFpbkhlYWRlckRhdGFiaW4pO1xyXG4gICAgdmFyIG9mZnNldHNDYWxjdWxhdG9yID0ganBpcEZhY3RvcnkuY3JlYXRlT2Zmc2V0c0NhbGN1bGF0b3IoXHJcbiAgICAgICAgbWFpbkhlYWRlckRhdGFiaW4sIG1hcmtlcnNQYXJzZXIpO1xyXG4gICAgdmFyIHN0cnVjdHVyZVBhcnNlciA9IGpwaXBGYWN0b3J5LmNyZWF0ZVN0cnVjdHVyZVBhcnNlcihcclxuICAgICAgICBkYXRhYmluc1NhdmVyLCBtYXJrZXJzUGFyc2VyLCBvZmZzZXRzQ2FsY3VsYXRvcik7XHJcbiAgICBcclxuICAgIHZhciBwcm9ncmVzc2lvbk9yZGVyID0gJ1JQQ0wnO1xyXG4gICAgdmFyIGNvZGVzdHJlYW1TdHJ1Y3R1cmUgPSBqcGlwRmFjdG9yeS5jcmVhdGVDb2Rlc3RyZWFtU3RydWN0dXJlKFxyXG4gICAgICAgIHN0cnVjdHVyZVBhcnNlciwgcHJvZ3Jlc3Npb25PcmRlcik7XHJcbiAgICBcclxuICAgIHZhciBxdWFsaXR5TGF5ZXJzQ2FjaGUgPSBqcGlwRmFjdG9yeS5jcmVhdGVRdWFsaXR5TGF5ZXJzQ2FjaGUoXHJcbiAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSk7XHJcbiAgICAgICAgXHJcbiAgICB2YXIgaGVhZGVyTW9kaWZpZXIgPSBqcGlwRmFjdG9yeS5jcmVhdGVIZWFkZXJNb2RpZmllcihcclxuICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLCBvZmZzZXRzQ2FsY3VsYXRvciwgcHJvZ3Jlc3Npb25PcmRlcik7XHJcbiAgICB2YXIgcmVjb25zdHJ1Y3RvciA9IGpwaXBGYWN0b3J5LmNyZWF0ZUNvZGVzdHJlYW1SZWNvbnN0cnVjdG9yKFxyXG4gICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsIGRhdGFiaW5zU2F2ZXIsIGhlYWRlck1vZGlmaWVyLCBxdWFsaXR5TGF5ZXJzQ2FjaGUpO1xyXG4gICAgdmFyIHBhY2tldHNEYXRhQ29sbGVjdG9yID0ganBpcEZhY3RvcnkuY3JlYXRlUGFja2V0c0RhdGFDb2xsZWN0b3IoXHJcbiAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSwgZGF0YWJpbnNTYXZlciwgcXVhbGl0eUxheWVyc0NhY2hlKTtcclxuICAgIFxyXG4gICAgdmFyIGpwaXBPYmplY3RzRm9yUmVxdWVzdENvbnRleHQgPSB7XHJcbiAgICAgICAgcmVjb25zdHJ1Y3RvcjogcmVjb25zdHJ1Y3RvcixcclxuICAgICAgICBwYWNrZXRzRGF0YUNvbGxlY3RvcjogcGFja2V0c0RhdGFDb2xsZWN0b3IsXHJcbiAgICAgICAgcXVhbGl0eUxheWVyc0NhY2hlOiBxdWFsaXR5TGF5ZXJzQ2FjaGUsXHJcbiAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZTogY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgICAgICBkYXRhYmluc1NhdmVyOiBkYXRhYmluc1NhdmVyLFxyXG4gICAgICAgIGpwaXBGYWN0b3J5OiBqcGlwRmFjdG9yeVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdmFyIHBhcmFtc01vZGlmaWVyID0ganBpcEZhY3RvcnkuY3JlYXRlUmVxdWVzdFBhcmFtc01vZGlmaWVyKGNvZGVzdHJlYW1TdHJ1Y3R1cmUpO1xyXG5cclxuICAgIHZhciBpbWFnZVBhcmFtcyA9IG51bGw7XHJcbiAgICB2YXIgbGV2ZWxDYWxjdWxhdG9yID0gbnVsbDtcclxuICAgIFxyXG4gICAgdmFyIGZldGNoZXIgPSBqcGlwRmFjdG9yeS5jcmVhdGVGZXRjaGVyKGRhdGFiaW5zU2F2ZXIsIG9wdGlvbnMpOyAvLyBUT0RPOiBXb3JrZXJQcm94eUZldGNoZXJcclxuICAgIC8vZnVuY3Rpb24gR3JpZEltYWdlQmFzZSgpIHtcclxuICAgIC8vICAgIHRoaXMuX2ZldGNoZXIgPSBmZXRjaGVyO1xyXG4gICAgLy8gICAgdGhpcy5faW1hZ2VQYXJhbXMgPSBudWxsO1xyXG4gICAgLy8gICAgdGhpcy5fd2FpdGluZ0ZldGNoZXMgPSB7fTtcclxuICAgIC8vICAgIHRoaXMuX2xldmVsQ2FsY3VsYXRvciA9IG51bGw7XHJcbiAgICAvL31cclxuXHJcbiAgICB0aGlzLm9wZW5lZCA9IGZ1bmN0aW9uIG9wZW5lZChpbWFnZURlY29kZXIpIHtcclxuICAgICAgICBpbWFnZVBhcmFtcyA9IGltYWdlRGVjb2Rlci5nZXRJbWFnZVBhcmFtcygpO1xyXG4gICAgICAgIC8vaW1hZ2VEZWNvZGVyLm9uRmV0Y2hlckV2ZW50KCdkYXRhJywgdGhpcy5fb25EYXRhRmV0Y2hlZC5iaW5kKHRoaXMpKTtcclxuICAgICAgICAvL2ltYWdlRGVjb2Rlci5vbkZldGNoZXJFdmVudCgndGlsZS10ZXJtaW5hdGVkJywgdGhpcy5fb25UaWxlVGVybWluYXRlZC5iaW5kKHRoaXMpKTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5nZXRMZXZlbENhbGN1bGF0b3IgPSBmdW5jdGlvbiBnZXRMZXZlbENhbGN1bGF0b3IoKSB7XHJcbiAgICAgICAgaWYgKGxldmVsQ2FsY3VsYXRvciA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICBsZXZlbENhbGN1bGF0b3IgPSBqcGlwRmFjdG9yeS5jcmVhdGVMZXZlbENhbGN1bGF0b3IoaW1hZ2VQYXJhbXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGV2ZWxDYWxjdWxhdG9yO1xyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLmdldERlY29kZXJXb3JrZXJzSW5wdXRSZXRyZWl2ZXIgPSBmdW5jdGlvbiBnZXREZWNvZGVyV29ya2Vyc0lucHV0UmV0cmVpdmVyKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRGZXRjaGVyID0gZnVuY3Rpb24gZ2V0RmV0Y2hlcigpIHtcclxuICAgICAgICByZXR1cm4gZmV0Y2hlcjtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5nZXRXb3JrZXJUeXBlT3B0aW9ucyA9IGZ1bmN0aW9uIGdldFdvcmtlclR5cGVPcHRpb25zKHRhc2tUeXBlKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY3Rvck5hbWU6ICd3ZWJqcGlwLlBkZmpzSnB4RGVjb2RlcicsXHJcbiAgICAgICAgICAgIGN0b3JBcmdzOiBbXSxcclxuICAgICAgICAgICAgc2NyaXB0c1RvSW1wb3J0OiBbZ2V0U2NyaXB0TmFtZShuZXcgRXJyb3IoKSldXHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5nZXRLZXlBc1N0cmluZyA9IGZ1bmN0aW9uIGdldEtleUFzU3RyaW5nKGtleSkge1xyXG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShrZXkpO1xyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnRhc2tTdGFydGVkID0gZnVuY3Rpb24gdGFza1N0YXJ0ZWQodGFzaykge1xyXG4gICAgICAgIHZhciBwYXJhbXMgPSBwYXJhbXNNb2RpZmllci5tb2RpZnkoLypjb2Rlc3RyZWFtVGFza1BhcmFtcz0qL3Rhc2sua2V5KTtcclxuICAgICAgICB2YXIgY29udGV4dCA9IGpwaXBGYWN0b3J5LmNyZWF0ZUltYWdlRGF0YUNvbnRleHQoXHJcbiAgICAgICAgICAgIGpwaXBPYmplY3RzRm9yUmVxdWVzdENvbnRleHQsXHJcbiAgICAgICAgICAgIHBhcmFtcy5jb2Rlc3RyZWFtUGFydFBhcmFtcyxcclxuICAgICAgICAgICAgcGFyYW1zLnByb2dyZXNzaXZlbmVzcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29udGV4dC5vbignZGF0YScsIG9uRGF0YSk7XHJcbiAgICAgICAgaWYgKGNvbnRleHQuaGFzRGF0YSgpKSB7XHJcbiAgICAgICAgICAgIG9uRGF0YShjb250ZXh0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gb25EYXRhKGNvbnRleHRfKSB7XHJcbiAgICAgICAgICAgIGlmIChjb250ZXh0ICE9PSBjb250ZXh0Xykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgJ3dlYmpwaXAgZXJyb3I6IFVuZXhwZWN0ZWQgY29udGV4dCBpbiBkYXRhIGV2ZW50JztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVE9ETzogRmlyc3QgcXVhbGl0eSBsYXllclxyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IGNvbnRleHQuZ2V0RmV0Y2hlZERhdGEoKTtcclxuICAgICAgICAgICAgdGFzay5kYXRhUmVhZHkoZGF0YSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoY29udGV4dC5pc0RvbmUoKSkge1xyXG4gICAgICAgICAgICAgICAgdGFzay50ZXJtaW5hdGUoKTtcclxuICAgICAgICAgICAgICAgIGNvbnRleHQuZGlzcG9zZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0U2NyaXB0TmFtZShlcnJvcldpdGhTdGFja1RyYWNlKSB7XHJcbiAgICB2YXIgc3RhY2sgPSBlcnJvcldpdGhTdGFja1RyYWNlLnN0YWNrLnRyaW0oKTtcclxuICAgIFxyXG4gICAgdmFyIGN1cnJlbnRTdGFja0ZyYW1lUmVnZXggPSAvYXQgKHxbXiBdKyBcXCgpKFteIF0rKTpcXGQrOlxcZCsvO1xyXG4gICAgdmFyIHNvdXJjZSA9IGN1cnJlbnRTdGFja0ZyYW1lUmVnZXguZXhlYyhzdGFjayk7XHJcbiAgICBpZiAoc291cmNlICYmIHNvdXJjZVsyXSAhPT0gXCJcIikge1xyXG4gICAgICAgIHJldHVybiBzb3VyY2VbMl07XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGxhc3RTdGFja0ZyYW1lUmVnZXggPSBuZXcgUmVnRXhwKC8uK1xcLyguKj8pOlxcZCsoOlxcZCspKiQvKTtcclxuICAgIHNvdXJjZSA9IGxhc3RTdGFja0ZyYW1lUmVnZXguZXhlYyhzdGFjayk7XHJcbiAgICBpZiAoc291cmNlICYmIHNvdXJjZVsxXSAhPT0gXCJcIikge1xyXG4gICAgICAgIHJldHVybiBzb3VyY2VbMV07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmIChlcnJvcldpdGhTdGFja1RyYWNlLmZpbGVOYW1lICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICByZXR1cm4gZXJyb3JXaXRoU3RhY2tUcmFjZS5maWxlTmFtZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhyb3cgJ0ltYWdlRGVjb2RlckZyYW1ld29yay5qczogQ291bGQgbm90IGdldCBjdXJyZW50IHNjcmlwdCBVUkwnO1xyXG59IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG52YXIgTE9HMiA9IE1hdGgubG9nKDIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwTGV2ZWxDYWxjdWxhdG9yKFxyXG4gICAgcGFyYW1zKSB7XHJcbiAgICBcclxuICAgIHZhciBFREdFX1RZUEVfTk9fRURHRSA9IDA7XHJcbiAgICB2YXIgRURHRV9UWVBFX0ZJUlNUID0gMTtcclxuICAgIHZhciBFREdFX1RZUEVfTEFTVCA9IDI7XHJcblxyXG4gICAgdGhpcy5FREdFX1RZUEVfTk9fRURHRSA9IEVER0VfVFlQRV9OT19FREdFO1xyXG4gICAgdGhpcy5FREdFX1RZUEVfRklSU1QgPSBFREdFX1RZUEVfRklSU1Q7XHJcbiAgICB0aGlzLkVER0VfVFlQRV9MQVNUID0gRURHRV9UWVBFX0xBU1Q7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0U2l6ZU9mUGFydCA9IGdldFNpemVPZlBhcnQ7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VGlsZXNGcm9tUGl4ZWxzID0gZ2V0VGlsZXNGcm9tUGl4ZWxzO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE51bVRpbGVzWCA9IGdldE51bVRpbGVzWDtcclxuICAgIFxyXG4gICAgdGhpcy5nZXROdW1UaWxlc1kgPSBnZXROdW1UaWxlc1k7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VGlsZVdpZHRoID0gZ2V0VGlsZVdpZHRoO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFRpbGVIZWlnaHQgPSBnZXRUaWxlSGVpZ2h0O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEZpcnN0VGlsZU9mZnNldFggPSBnZXRGaXJzdFRpbGVPZmZzZXRYO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEZpcnN0VGlsZU9mZnNldFkgPSBnZXRGaXJzdFRpbGVPZmZzZXRZO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEZpcnN0VGlsZVdpZHRoID0gZ2V0Rmlyc3RUaWxlV2lkdGg7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Rmlyc3RUaWxlSGVpZ2h0ID0gZ2V0Rmlyc3RUaWxlSGVpZ2h0O1xyXG4gICAgXHJcbiAgICB0aGlzLmlzRWRnZVRpbGVJZCA9IGlzRWRnZVRpbGVJZDtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRUaWxlU2l6ZSA9IGdldFRpbGVTaXplO1xyXG4gICAgXHJcbiAgICAvLyBQdWJsaWMgbWV0aG9kcyBmb3IgaW1hZ2VEZWNvZGVyRnJhbWV3b3JrLmpzXHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TGV2ZWxXaWR0aCA9IGdldExldmVsV2lkdGg7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TGV2ZWxIZWlnaHQgPSBnZXRMZXZlbEhlaWdodDtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRJbWFnZUxldmVsID0gZnVuY3Rpb24gZ2V0SW1hZ2VMZXZlbCgpIHtcclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TGV2ZWwgPSBmdW5jdGlvbiBnZXRMZXZlbChyZWdpb25JbWFnZUxldmVsKSB7XHJcbiAgICAgICAgaWYgKHBhcmFtcy5udW1SZXNvbHV0aW9uTGV2ZWxzRm9yTGltaXR0ZWRWaWV3ZXIgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aHJvdyAnVGhpcyBtZXRob2QgaXMgYXZhaWxhYmxlIG9ubHkgd2hlbiBqcGlwU2l6ZXNDYWxjdWxhdG9yICcgK1xyXG4gICAgICAgICAgICAgICAgJ2lzIGNyZWF0ZWQgZnJvbSBwYXJhbXMgcmV0dXJuZWQgYnkganBpcENvZGVzdHJlYW1DbGllbnQuICcgK1xyXG4gICAgICAgICAgICAgICAgJ0l0IHNoYWxsIGJlIHVzZWQgZm9yIEpQSVAgQVBJIHB1cnBvc2VzIG9ubHknO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgbGV2ZWxYID0gTWF0aC5sb2coKHJlZ2lvbkltYWdlTGV2ZWwubWF4WEV4Y2x1c2l2ZSAtIHJlZ2lvbkltYWdlTGV2ZWwubWluWCkgLyByZWdpb25JbWFnZUxldmVsLnNjcmVlbldpZHRoICkgLyBMT0cyO1xyXG4gICAgICAgIHZhciBsZXZlbFkgPSBNYXRoLmxvZygocmVnaW9uSW1hZ2VMZXZlbC5tYXhZRXhjbHVzaXZlIC0gcmVnaW9uSW1hZ2VMZXZlbC5taW5ZKSAvIHJlZ2lvbkltYWdlTGV2ZWwuc2NyZWVuSGVpZ2h0KSAvIExPRzI7XHJcbiAgICAgICAgdmFyIGxldmVsID0gTWF0aC5jZWlsKE1hdGgubWF4KGxldmVsWCwgbGV2ZWxZKSk7XHJcbiAgICAgICAgbGV2ZWwgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihwYXJhbXMubnVtUmVzb2x1dGlvbkxldmVsc0ZvckxpbWl0dGVkVmlld2VyIC0gMSwgbGV2ZWwpKTtcclxuICAgICAgICByZXR1cm4gbGV2ZWw7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE51bVJlc29sdXRpb25MZXZlbHNGb3JMaW1pdHRlZFZpZXdlciA9XHJcbiAgICAgICAgZnVuY3Rpb24gZ2V0TnVtUmVzb2x1dGlvbkxldmVsc0ZvckxpbWl0dGVkVmlld2VyKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChwYXJhbXMubnVtUmVzb2x1dGlvbkxldmVsc0ZvckxpbWl0dGVkVmlld2VyID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgJ1RoaXMgbWV0aG9kIGlzIGF2YWlsYWJsZSBvbmx5IHdoZW4ganBpcFNpemVzQ2FsY3VsYXRvciAnICtcclxuICAgICAgICAgICAgICAgICdpcyBjcmVhdGVkIGZyb20gcGFyYW1zIHJldHVybmVkIGJ5IGpwaXBDb2Rlc3RyZWFtQ2xpZW50LiAnICtcclxuICAgICAgICAgICAgICAgICdJdCBzaGFsbCBiZSB1c2VkIGZvciBKUElQIEFQSSBwdXJwb3NlcyBvbmx5JztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHBhcmFtcy5udW1SZXNvbHV0aW9uTGV2ZWxzRm9yTGltaXR0ZWRWaWV3ZXI7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldExvd2VzdFF1YWxpdHkgPSBmdW5jdGlvbiBnZXRMb3dlc3RRdWFsaXR5KCkge1xyXG4gICAgICAgIHJldHVybiAxO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRIaWdoZXN0UXVhbGl0eSA9IGZ1bmN0aW9uIGdldEhpZ2hlc3RRdWFsaXR5KCkge1xyXG4gICAgICAgIGlmIChwYXJhbXMuaGlnaGVzdFF1YWxpdHkgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aHJvdyAnVGhpcyBtZXRob2QgaXMgYXZhaWxhYmxlIG9ubHkgd2hlbiBqcGlwU2l6ZXNDYWxjdWxhdG9yICcgK1xyXG4gICAgICAgICAgICAgICAgJ2lzIGNyZWF0ZWQgZnJvbSBwYXJhbXMgcmV0dXJuZWQgYnkganBpcENvZGVzdHJlYW1DbGllbnQuICcgK1xyXG4gICAgICAgICAgICAgICAgJ0l0IHNoYWxsIGJlIHVzZWQgZm9yIEpQSVAgQVBJIHB1cnBvc2VzIG9ubHknO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcGFyYW1zLmhpZ2hlc3RRdWFsaXR5O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gUHJpdmF0ZSBtZXRob2RzXHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldFNpemVPZlBhcnQoY29kZXN0cmVhbVBhcnRQYXJhbXMpIHtcclxuICAgICAgICB2YXIgbGV2ZWwgPVxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5sZXZlbDtcclxuICAgICAgICB2YXIgdGlsZVdpZHRoID0gZ2V0VGlsZVdpZHRoKGxldmVsKTtcclxuICAgICAgICB2YXIgdGlsZUhlaWdodCA9IGdldFRpbGVIZWlnaHQobGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlQm91bmRzID0gZ2V0VGlsZXNGcm9tUGl4ZWxzKGNvZGVzdHJlYW1QYXJ0UGFyYW1zKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZmlyc3RUaWxlSW5kZXggPVxyXG4gICAgICAgICAgICB0aWxlQm91bmRzLm1pblRpbGVYICsgdGlsZUJvdW5kcy5taW5UaWxlWSAqIGdldE51bVRpbGVzWCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB2YXIgbGFzdFRpbGVJbmRleCA9XHJcbiAgICAgICAgICAgICh0aWxlQm91bmRzLm1heFRpbGVYRXhjbHVzaXZlIC0gMSkgK1xyXG4gICAgICAgICAgICAodGlsZUJvdW5kcy5tYXhUaWxlWUV4Y2x1c2l2ZSAtIDEpICogZ2V0TnVtVGlsZXNYKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZpcnN0RWRnZVR5cGUgPSBpc0VkZ2VUaWxlSWQoZmlyc3RUaWxlSW5kZXgpO1xyXG4gICAgICAgIHZhciBsYXN0RWRnZVR5cGUgPSBpc0VkZ2VUaWxlSWQobGFzdFRpbGVJbmRleCk7XHJcbiAgICAgICAgdmFyIGZpcnN0U2l6ZSA9IGdldFRpbGVTaXplKGZpcnN0RWRnZVR5cGUsIGxldmVsKTtcclxuICAgICAgICB2YXIgbGFzdFNpemUgPSBnZXRUaWxlU2l6ZShsYXN0RWRnZVR5cGUsIGxldmVsKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgd2lkdGggPSBmaXJzdFNpemVbMF07XHJcbiAgICAgICAgdmFyIGhlaWdodCA9IGZpcnN0U2l6ZVsxXTtcclxuXHJcbiAgICAgICAgdmFyIHRpbGVzWCA9IHRpbGVCb3VuZHMubWF4VGlsZVhFeGNsdXNpdmUgLSB0aWxlQm91bmRzLm1pblRpbGVYO1xyXG4gICAgICAgIHZhciB0aWxlc1kgPSB0aWxlQm91bmRzLm1heFRpbGVZRXhjbHVzaXZlIC0gdGlsZUJvdW5kcy5taW5UaWxlWTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGlsZXNYID4gMSkge1xyXG4gICAgICAgICAgICB3aWR0aCArPSBsYXN0U2l6ZVswXTtcclxuICAgICAgICAgICAgd2lkdGggKz0gdGlsZVdpZHRoICogKHRpbGVzWCAtIDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAodGlsZXNZID4gMSkge1xyXG4gICAgICAgICAgICBoZWlnaHQgKz0gbGFzdFNpemVbMV07XHJcbiAgICAgICAgICAgIGhlaWdodCArPSB0aWxlSGVpZ2h0ICogKHRpbGVzWSAtIDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXHJcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldFRpbGVzRnJvbVBpeGVscyhwYXJ0UGFyYW1zKSB7XHJcbiAgICAgICAgdmFyIGxldmVsID1cclxuICAgICAgICAgICAgcGFydFBhcmFtcy5sZXZlbDtcclxuXHJcbiAgICAgICAgdmFyIHRpbGVXaWR0aCA9IGdldFRpbGVXaWR0aChsZXZlbCk7XHJcbiAgICAgICAgdmFyIHRpbGVIZWlnaHQgPSBnZXRUaWxlSGVpZ2h0KGxldmVsKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZmlyc3RUaWxlV2lkdGggPSBnZXRGaXJzdFRpbGVXaWR0aChsZXZlbCk7XHJcbiAgICAgICAgdmFyIGZpcnN0VGlsZUhlaWdodCA9IGdldEZpcnN0VGlsZUhlaWdodChsZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN0YXJ0WE5vRmlyc3QgPSAocGFydFBhcmFtcy5taW5YIC0gZmlyc3RUaWxlV2lkdGgpIC8gdGlsZVdpZHRoO1xyXG4gICAgICAgIHZhciBzdGFydFlOb0ZpcnN0ID0gKHBhcnRQYXJhbXMubWluWSAtIGZpcnN0VGlsZUhlaWdodCkgLyB0aWxlSGVpZ2h0O1xyXG4gICAgICAgIHZhciBlbmRYTm9GaXJzdCA9IChwYXJ0UGFyYW1zLm1heFhFeGNsdXNpdmUgLSBmaXJzdFRpbGVXaWR0aCkgLyB0aWxlV2lkdGg7XHJcbiAgICAgICAgdmFyIGVuZFlOb0ZpcnN0ID0gKHBhcnRQYXJhbXMubWF4WUV4Y2x1c2l2ZSAtIGZpcnN0VGlsZUhlaWdodCkgLyB0aWxlSGVpZ2h0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBtaW5UaWxlWCA9IE1hdGgubWF4KDAsIDEgKyBzdGFydFhOb0ZpcnN0KTtcclxuICAgICAgICB2YXIgbWluVGlsZVkgPSBNYXRoLm1heCgwLCAxICsgc3RhcnRZTm9GaXJzdCk7XHJcbiAgICAgICAgdmFyIG1heFRpbGVYID0gTWF0aC5taW4oZ2V0TnVtVGlsZXNYKCksIDEgKyBlbmRYTm9GaXJzdCk7XHJcbiAgICAgICAgdmFyIG1heFRpbGVZID0gTWF0aC5taW4oZ2V0TnVtVGlsZXNZKCksIDEgKyBlbmRZTm9GaXJzdCk7XHJcblxyXG4gICAgICAgIHZhciBib3VuZHMgPSB7XHJcbiAgICAgICAgICAgIG1pblRpbGVYOiBNYXRoLmZsb29yKG1pblRpbGVYKSxcclxuICAgICAgICAgICAgbWluVGlsZVk6IE1hdGguZmxvb3IobWluVGlsZVkpLFxyXG4gICAgICAgICAgICBtYXhUaWxlWEV4Y2x1c2l2ZTogTWF0aC5jZWlsKG1heFRpbGVYKSxcclxuICAgICAgICAgICAgbWF4VGlsZVlFeGNsdXNpdmU6IE1hdGguY2VpbChtYXhUaWxlWSlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gYm91bmRzO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFRpbGVTaXplKGVkZ2VUeXBlLCBsZXZlbCkge1xyXG4gICAgICAgIHZhciB0aWxlV2lkdGggPSBnZXRUaWxlRGltZW5zaW9uU2l6ZShcclxuICAgICAgICAgICAgZWRnZVR5cGUuaG9yaXpvbnRhbEVkZ2VUeXBlLFxyXG4gICAgICAgICAgICBnZXRGaXJzdFRpbGVXaWR0aCxcclxuICAgICAgICAgICAgZ2V0TGV2ZWxXaWR0aCxcclxuICAgICAgICAgICAgZ2V0VGlsZVdpZHRoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgdGlsZUhlaWdodCA9IGdldFRpbGVEaW1lbnNpb25TaXplKFxyXG4gICAgICAgICAgICBlZGdlVHlwZS52ZXJ0aWNhbEVkZ2VUeXBlLFxyXG4gICAgICAgICAgICBnZXRGaXJzdFRpbGVIZWlnaHQsXHJcbiAgICAgICAgICAgIGdldExldmVsSGVpZ2h0LFxyXG4gICAgICAgICAgICBnZXRUaWxlSGVpZ2h0KTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAobGV2ZWwgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB2YXIgc2NhbGUgPSAxIDw8IGxldmVsO1xyXG4gICAgICAgICAgICB0aWxlV2lkdGggPSBNYXRoLmNlaWwodGlsZVdpZHRoIC8gc2NhbGUpO1xyXG4gICAgICAgICAgICB0aWxlSGVpZ2h0ID0gTWF0aC5jZWlsKHRpbGVIZWlnaHQgLyBzY2FsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBbdGlsZVdpZHRoLCB0aWxlSGVpZ2h0XTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRUaWxlRGltZW5zaW9uU2l6ZShcclxuICAgICAgICBlZGdlVHlwZSwgZ2V0Rmlyc3RUaWxlU2l6ZSwgZ2V0TGV2ZWxTaXplLCBnZXROb25FZGdlVGlsZVNpemUpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAoZWRnZVR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBFREdFX1RZUEVfRklSU1Q6XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBnZXRGaXJzdFRpbGVTaXplKCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgRURHRV9UWVBFX0xBU1Q6XHJcbiAgICAgICAgICAgICAgICB2YXIgbm9uRWRnZVRpbGVTaXplID0gZ2V0Tm9uRWRnZVRpbGVTaXplKCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgd2lkdGhXaXRob3V0Rmlyc3QgPSBnZXRMZXZlbFNpemUoKSAtIGdldEZpcnN0VGlsZVNpemUoKTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHdpZHRoV2l0aG91dEZpcnN0ICUgbm9uRWRnZVRpbGVTaXplO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gbm9uRWRnZVRpbGVTaXplO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgRURHRV9UWVBFX05PX0VER0U6XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBnZXROb25FZGdlVGlsZVNpemUoKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdVbmV4cGVjdGVkIGVkZ2UgdHlwZTogJyArIGVkZ2VUeXBlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGlzRWRnZVRpbGVJZCh0aWxlSWQpIHtcclxuICAgICAgICB2YXIgbnVtVGlsZXNYID0gZ2V0TnVtVGlsZXNYKCk7XHJcbiAgICAgICAgdmFyIG51bVRpbGVzWSA9IGdldE51bVRpbGVzWSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlWCA9IHRpbGVJZCAlIG51bVRpbGVzWDtcclxuICAgICAgICB2YXIgdGlsZVkgPSBNYXRoLmZsb29yKHRpbGVJZCAvIG51bVRpbGVzWCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRpbGVZID4gbnVtVGlsZXNZIHx8IHRpbGVYIDwgMCB8fCB0aWxlWSA8IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnVGlsZSBpbmRleCAnICsgdGlsZUlkICsgJyBpcyBub3QgaW4gcmFuZ2UnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGhvcml6b250YWxFZGdlID1cclxuICAgICAgICAgICAgdGlsZVggPT09IDAgPyBFREdFX1RZUEVfRklSU1QgOlxyXG4gICAgICAgICAgICB0aWxlWCA9PT0gKG51bVRpbGVzWCAtIDEpID8gRURHRV9UWVBFX0xBU1QgOlxyXG4gICAgICAgICAgICBFREdFX1RZUEVfTk9fRURHRTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgdmVydGljYWxFZGdlID1cclxuICAgICAgICAgICAgdGlsZVkgPT09IDAgPyBFREdFX1RZUEVfRklSU1QgOlxyXG4gICAgICAgICAgICB0aWxlWSA9PT0gKG51bVRpbGVzWSAtIDEpID8gRURHRV9UWVBFX0xBU1QgOlxyXG4gICAgICAgICAgICBFREdFX1RZUEVfTk9fRURHRTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICBob3Jpem9udGFsRWRnZVR5cGU6IGhvcml6b250YWxFZGdlLFxyXG4gICAgICAgICAgICB2ZXJ0aWNhbEVkZ2VUeXBlOiB2ZXJ0aWNhbEVkZ2VcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldE51bVRpbGVzWCgpIHtcclxuICAgICAgICB2YXIgbnVtVGlsZXNYID0gTWF0aC5jZWlsKHBhcmFtcy5pbWFnZVdpZHRoIC8gcGFyYW1zLnRpbGVXaWR0aCk7XHJcbiAgICAgICAgcmV0dXJuIG51bVRpbGVzWDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0TnVtVGlsZXNZKCkge1xyXG4gICAgICAgIHZhciBudW1UaWxlc1kgPSBNYXRoLmNlaWwocGFyYW1zLmltYWdlSGVpZ2h0IC8gcGFyYW1zLnRpbGVIZWlnaHQpO1xyXG4gICAgICAgIHJldHVybiBudW1UaWxlc1k7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldExldmVsV2lkdGgobGV2ZWwpIHtcclxuICAgICAgICBpZiAobGV2ZWwgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyYW1zLmltYWdlV2lkdGg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzaXplID0gZ2V0U2l6ZU9mUGFydCh7XHJcbiAgICAgICAgICAgIG1pblg6IDAsXHJcbiAgICAgICAgICAgIG1heFhFeGNsdXNpdmU6IHBhcmFtcy5pbWFnZVdpZHRoLFxyXG4gICAgICAgICAgICBtaW5ZOiAwLFxyXG4gICAgICAgICAgICBtYXhZRXhjbHVzaXZlOiBwYXJhbXMuaW1hZ2VIZWlnaHQsXHJcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gc2l6ZS53aWR0aDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0TGV2ZWxIZWlnaHQobGV2ZWwpIHtcclxuICAgICAgICBpZiAobGV2ZWwgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyYW1zLmltYWdlSGVpZ2h0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2l6ZSA9IGdldFNpemVPZlBhcnQoe1xyXG4gICAgICAgICAgICBtaW5YOiAwLFxyXG4gICAgICAgICAgICBtYXhYRXhjbHVzaXZlOiBwYXJhbXMuaW1hZ2VXaWR0aCxcclxuICAgICAgICAgICAgbWluWTogMCxcclxuICAgICAgICAgICAgbWF4WUV4Y2x1c2l2ZTogcGFyYW1zLmltYWdlSGVpZ2h0LFxyXG4gICAgICAgICAgICBsZXZlbDogbGV2ZWxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHNpemUuaGVpZ2h0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFRpbGVXaWR0aChsZXZlbCkge1xyXG4gICAgICAgIGlmIChsZXZlbCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJhbXMudGlsZVdpZHRoO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHZhciBzY2FsZSA9IDEgPDwgbGV2ZWw7XHJcbiAgICAgICAgdmFyIHdpZHRoID0gTWF0aC5jZWlsKHBhcmFtcy50aWxlV2lkdGggLyBzY2FsZSk7XHJcbiAgICAgICAgcmV0dXJuIHdpZHRoO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRUaWxlSGVpZ2h0KGxldmVsKSB7XHJcbiAgICAgICAgaWYgKGxldmVsID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtcy50aWxlSGVpZ2h0O1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHZhciBzY2FsZSA9IDEgPDwgbGV2ZWw7XHJcbiAgICAgICAgdmFyIGhlaWdodCA9IE1hdGguY2VpbChwYXJhbXMudGlsZUhlaWdodCAvIHNjYWxlKTtcclxuICAgICAgICByZXR1cm4gaGVpZ2h0O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRGaXJzdFRpbGVPZmZzZXRYKCkge1xyXG4gICAgICAgIHJldHVybiBwYXJhbXMuZmlyc3RUaWxlT2Zmc2V0WDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0Rmlyc3RUaWxlT2Zmc2V0WSgpIHtcclxuICAgICAgICByZXR1cm4gcGFyYW1zLmZpcnN0VGlsZU9mZnNldFk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0Rmlyc3RUaWxlV2lkdGgobGV2ZWwpIHtcclxuICAgICAgICB2YXIgZmlyc3RUaWxlV2lkdGhCZXN0TGV2ZWwgPVxyXG4gICAgICAgICAgICBnZXRUaWxlV2lkdGgoKSAtIGdldEZpcnN0VGlsZU9mZnNldFgoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW1hZ2VXaWR0aCA9IGdldExldmVsV2lkdGgoKTtcclxuICAgICAgICBpZiAoZmlyc3RUaWxlV2lkdGhCZXN0TGV2ZWwgPiBpbWFnZVdpZHRoKSB7XHJcbiAgICAgICAgICAgIGZpcnN0VGlsZVdpZHRoQmVzdExldmVsID0gaW1hZ2VXaWR0aDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNjYWxlID0gMSA8PCBsZXZlbDtcclxuICAgICAgICB2YXIgZmlyc3RUaWxlV2lkdGggPSBNYXRoLmNlaWwoZmlyc3RUaWxlV2lkdGhCZXN0TGV2ZWwgLyBzY2FsZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZpcnN0VGlsZVdpZHRoO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRGaXJzdFRpbGVIZWlnaHQobGV2ZWwpIHtcclxuICAgICAgICB2YXIgZmlyc3RUaWxlSGVpZ2h0QmVzdExldmVsID1cclxuICAgICAgICAgICAgZ2V0VGlsZUhlaWdodCgpIC0gZ2V0Rmlyc3RUaWxlT2Zmc2V0WSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpbWFnZUhlaWdodCA9IGdldExldmVsSGVpZ2h0KCk7XHJcbiAgICAgICAgaWYgKGZpcnN0VGlsZUhlaWdodEJlc3RMZXZlbCA+IGltYWdlSGVpZ2h0KSB7XHJcbiAgICAgICAgICAgIGZpcnN0VGlsZUhlaWdodEJlc3RMZXZlbCA9IGltYWdlSGVpZ2h0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2NhbGUgPSAxIDw8IGxldmVsO1xyXG4gICAgICAgIHZhciBmaXJzdFRpbGVIZWlnaHQgPSBNYXRoLmNlaWwoZmlyc3RUaWxlSGVpZ2h0QmVzdExldmVsIC8gc2NhbGUpO1xyXG5cclxuICAgICAgICByZXR1cm4gZmlyc3RUaWxlSGVpZ2h0O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUGRmanNKcHhEZWNvZGVyO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxuZnVuY3Rpb24gUGRmanNKcHhEZWNvZGVyKCkge1xyXG4gICAgdGhpcy5faW1hZ2UgPSBuZXcgSnB4SW1hZ2UoKTtcclxufVxyXG5cclxuUGRmanNKcHhEZWNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uIHN0YXJ0KGRhdGEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICB2YXIgcmVnaW9uVG9QYXJzZSA9IHtcclxuICAgICAgICAgICAgbGVmdCAgOiBkYXRhLmhlYWRlcnNDb2Rlc3RyZWFtLm9mZnNldFgsXHJcbiAgICAgICAgICAgIHRvcCAgIDogZGF0YS5oZWFkZXJzQ29kZXN0cmVhbS5vZmZzZXRZLFxyXG4gICAgICAgICAgICByaWdodCA6IGRhdGEuaGVhZGVyc0NvZGVzdHJlYW0ub2Zmc2V0WCArIGRhdGEuY29kZXN0cmVhbVBhcnRQYXJhbXMubWF4WEV4Y2x1c2l2ZSAtIGRhdGEuY29kZXN0cmVhbVBhcnRQYXJhbXMubWluWCxcclxuICAgICAgICAgICAgYm90dG9tOiBkYXRhLmhlYWRlcnNDb2Rlc3RyZWFtLm9mZnNldFkgKyBkYXRhLmNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1heFlFeGNsdXNpdmUgLSBkYXRhLmNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1pbllcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjdXJyZW50Q29udGV4dCA9IHNlbGYuX2ltYWdlLnBhcnNlQ29kZXN0cmVhbShcclxuICAgICAgICAgICAgZGF0YS5oZWFkZXJzQ29kZXN0cmVhbS5jb2Rlc3RyZWFtLFxyXG4gICAgICAgICAgICAwLFxyXG4gICAgICAgICAgICBkYXRhLmhlYWRlcnNDb2Rlc3RyZWFtLmNvZGVzdHJlYW0ubGVuZ3RoLFxyXG4gICAgICAgICAgICB7IGlzT25seVBhcnNlSGVhZGVyczogdHJ1ZSB9KTtcclxuICAgICAgICBcclxuICAgICAgICBzZWxmLl9pbWFnZS5hZGRQYWNrZXRzRGF0YShjdXJyZW50Q29udGV4dCwgZGF0YS5jb2RlYmxvY2tzRGF0YSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2VsZi5faW1hZ2UuZGVjb2RlKGN1cnJlbnRDb250ZXh0LCB7IHJlZ2lvblRvUGFyc2U6IHJlZ2lvblRvUGFyc2UgfSk7XHJcblxyXG4gICAgICAgIHZhciByZXN1bHQgPSBzZWxmLl9jb3B5VGlsZXNQaXhlbHNUb09uZVBpeGVsc0FycmF5KHNlbGYuX2ltYWdlLnRpbGVzLCByZWdpb25Ub1BhcnNlLCBzZWxmLl9pbWFnZS5jb21wb25lbnRzQ291bnQpO1xyXG4gICAgICAgIHJlc29sdmUocmVzdWx0KTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuUGRmanNKcHhEZWNvZGVyLnByb3RvdHlwZS5fY29weVRpbGVzUGl4ZWxzVG9PbmVQaXhlbHNBcnJheSA9XHJcbiAgICBmdW5jdGlvbiBjb3B5VGlsZXNQaXhlbHNUb09uZVBpeGVsc0FycmF5KHRpbGVzLCByZXN1bHRSZWdpb24sIGNvbXBvbmVudHNDb3VudCkge1xyXG4gICAgICAgIFxyXG4gICAgdmFyIGZpcnN0VGlsZSA9IHRpbGVzWzBdO1xyXG4gICAgdmFyIHdpZHRoID0gcmVzdWx0UmVnaW9uLnJpZ2h0IC0gcmVzdWx0UmVnaW9uLmxlZnQ7XHJcbiAgICB2YXIgaGVpZ2h0ID0gcmVzdWx0UmVnaW9uLmJvdHRvbSAtIHJlc3VsdFJlZ2lvbi50b3A7XHJcbiAgICBcclxuICAgIC8vaWYgKGZpcnN0VGlsZS5sZWZ0ID09PSByZXN1bHRSZWdpb24ubGVmdCAmJlxyXG4gICAgLy8gICAgZmlyc3RUaWxlLnRvcCA9PT0gcmVzdWx0UmVnaW9uLnRvcCAmJlxyXG4gICAgLy8gICAgZmlyc3RUaWxlLndpZHRoID09PSB3aWR0aCAmJlxyXG4gICAgLy8gICAgZmlyc3RUaWxlLmhlaWdodCA9PT0gaGVpZ2h0ICYmXHJcbiAgICAvLyAgICBjb21wb25lbnRzQ291bnQgPT09IDQpIHtcclxuICAgIC8vICAgIFxyXG4gICAgLy8gICAgcmV0dXJuIGZpcnN0VGlsZTtcclxuICAgIC8vfVxyXG4gICAgXHJcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEltYWdlRGF0YSh3aWR0aCwgaGVpZ2h0KTtcclxuICAgICAgXHJcbiAgICB2YXIgYnl0ZXNQZXJQaXhlbCA9IDQ7XHJcbiAgICB2YXIgcmdiYUltYWdlU3RyaWRlID0gd2lkdGggKiBieXRlc1BlclBpeGVsO1xyXG4gICAgXHJcbiAgICB2YXIgdGlsZUluZGV4ID0gMDtcclxuICAgIFxyXG4gICAgLy9mb3IgKHZhciB4ID0gMDsgeCA8IG51bVRpbGVzWDsgKyt4KSB7XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aWxlcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgIHZhciB0aWxlUmlnaHQgPSB0aWxlc1tpXS5sZWZ0ICsgdGlsZXNbaV0ud2lkdGg7XHJcbiAgICAgICAgdmFyIHRpbGVCb3R0b20gPSB0aWxlc1tpXS50b3AgKyB0aWxlc1tpXS5oZWlnaHQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGludGVyc2VjdGlvbkxlZnQgPSBNYXRoLm1heChyZXN1bHRSZWdpb24ubGVmdCwgdGlsZXNbaV0ubGVmdCk7XHJcbiAgICAgICAgdmFyIGludGVyc2VjdGlvblRvcCA9IE1hdGgubWF4KHJlc3VsdFJlZ2lvbi50b3AsIHRpbGVzW2ldLnRvcCk7XHJcbiAgICAgICAgdmFyIGludGVyc2VjdGlvblJpZ2h0ID0gTWF0aC5taW4ocmVzdWx0UmVnaW9uLnJpZ2h0LCB0aWxlUmlnaHQpO1xyXG4gICAgICAgIHZhciBpbnRlcnNlY3Rpb25Cb3R0b20gPSBNYXRoLm1pbihyZXN1bHRSZWdpb24uYm90dG9tLCB0aWxlQm90dG9tKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW50ZXJzZWN0aW9uV2lkdGggPSBpbnRlcnNlY3Rpb25SaWdodCAtIGludGVyc2VjdGlvbkxlZnQ7XHJcbiAgICAgICAgdmFyIGludGVyc2VjdGlvbkhlaWdodCA9IGludGVyc2VjdGlvbkJvdHRvbSAtIGludGVyc2VjdGlvblRvcDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaW50ZXJzZWN0aW9uTGVmdCAhPT0gdGlsZXNbaV0ubGVmdCB8fFxyXG4gICAgICAgICAgICBpbnRlcnNlY3Rpb25Ub3AgIT09IHRpbGVzW2ldLnRvcCB8fFxyXG4gICAgICAgICAgICBpbnRlcnNlY3Rpb25XaWR0aCAhPT0gdGlsZXNbaV0ud2lkdGggfHxcclxuICAgICAgICAgICAgaW50ZXJzZWN0aW9uSGVpZ2h0ICE9PSB0aWxlc1tpXS5oZWlnaHQpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRocm93ICdVbnN1cHBvcnRlZCB0aWxlcyB0byBjb3B5JztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVPZmZzZXRYUGl4ZWxzID0gaW50ZXJzZWN0aW9uTGVmdCAtIHJlc3VsdFJlZ2lvbi5sZWZ0O1xyXG4gICAgICAgIHZhciB0aWxlT2Zmc2V0WVBpeGVscyA9IGludGVyc2VjdGlvblRvcCAtIHJlc3VsdFJlZ2lvbi50b3A7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlT2Zmc2V0Qnl0ZXMgPVxyXG4gICAgICAgICAgICB0aWxlT2Zmc2V0WFBpeGVscyAqIGJ5dGVzUGVyUGl4ZWwgK1xyXG4gICAgICAgICAgICB0aWxlT2Zmc2V0WVBpeGVscyAqIHJnYmFJbWFnZVN0cmlkZTtcclxuXHJcbiAgICAgICAgdGhpcy5fY29weVRpbGUoXHJcbiAgICAgICAgICAgIHJlc3VsdC5kYXRhLCB0aWxlc1tpXSwgdGlsZU9mZnNldEJ5dGVzLCByZ2JhSW1hZ2VTdHJpZGUsIGNvbXBvbmVudHNDb3VudCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn07XHJcblxyXG5QZGZqc0pweERlY29kZXIucHJvdG90eXBlLl9jb3B5VGlsZSA9IGZ1bmN0aW9uIGNvcHlUaWxlKFxyXG4gICAgdGFyZ2V0SW1hZ2UsIHRpbGUsIHRhcmdldEltYWdlU3RhcnRPZmZzZXQsIHRhcmdldEltYWdlU3RyaWRlLCBjb21wb25lbnRzQ291bnQpIHtcclxuICAgIFxyXG4gICAgdmFyIHJPZmZzZXQgPSAwO1xyXG4gICAgdmFyIGdPZmZzZXQgPSAxO1xyXG4gICAgdmFyIGJPZmZzZXQgPSAyO1xyXG4gICAgdmFyIHBpeGVsc09mZnNldCA9IDE7XHJcbiAgICBcclxuICAgIHZhciBwaXhlbHMgPSB0aWxlLnBpeGVscyB8fCB0aWxlLml0ZW1zO1xyXG4gICAgXHJcbiAgICBpZiAoY29tcG9uZW50c0NvdW50ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBjb21wb25lbnRzQ291bnQgPSBwaXhlbHMubGVuZ3RoIC8gKHRpbGUud2lkdGggKiB0aWxlLmhlaWdodCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHN3aXRjaCAoY29tcG9uZW50c0NvdW50KSB7XHJcbiAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICBnT2Zmc2V0ID0gMDtcclxuICAgICAgICAgICAgYk9mZnNldCA9IDA7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgcGl4ZWxzT2Zmc2V0ID0gMztcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNhc2UgNDpcclxuICAgICAgICAgICAgcGl4ZWxzT2Zmc2V0ID0gNDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93ICdVbnN1cHBvcnRlZCBjb21wb25lbnRzIGNvdW50ICcgKyBjb21wb25lbnRzQ291bnQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciB0YXJnZXRJbWFnZUluZGV4ID0gdGFyZ2V0SW1hZ2VTdGFydE9mZnNldDtcclxuICAgIHZhciBwaXhlbCA9IDA7XHJcbiAgICBmb3IgKHZhciB5ID0gMDsgeSA8IHRpbGUuaGVpZ2h0OyArK3kpIHtcclxuICAgICAgICB2YXIgdGFyZ2V0SW1hZ2VTdGFydExpbmUgPSB0YXJnZXRJbWFnZUluZGV4O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAodmFyIHggPSAwOyB4IDwgdGlsZS53aWR0aDsgKyt4KSB7XHJcbiAgICAgICAgICAgIHRhcmdldEltYWdlW3RhcmdldEltYWdlSW5kZXggKyAwXSA9IHBpeGVsc1twaXhlbCArIHJPZmZzZXRdO1xyXG4gICAgICAgICAgICB0YXJnZXRJbWFnZVt0YXJnZXRJbWFnZUluZGV4ICsgMV0gPSBwaXhlbHNbcGl4ZWwgKyBnT2Zmc2V0XTtcclxuICAgICAgICAgICAgdGFyZ2V0SW1hZ2VbdGFyZ2V0SW1hZ2VJbmRleCArIDJdID0gcGl4ZWxzW3BpeGVsICsgYk9mZnNldF07XHJcbiAgICAgICAgICAgIHRhcmdldEltYWdlW3RhcmdldEltYWdlSW5kZXggKyAzXSA9IDI1NTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHBpeGVsICs9IHBpeGVsc09mZnNldDtcclxuICAgICAgICAgICAgdGFyZ2V0SW1hZ2VJbmRleCArPSA0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0YXJnZXRJbWFnZUluZGV4ID0gdGFyZ2V0SW1hZ2VTdGFydExpbmUgKyB0YXJnZXRJbWFnZVN0cmlkZTtcclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIENvbXBvc2l0ZUFycmF5KG9mZnNldCkge1xyXG4gICAgdmFyIGxlbmd0aCA9IDA7XHJcbiAgICB2YXIgaW50ZXJuYWxQYXJ0cyA9IFtdO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldExlbmd0aCA9IGZ1bmN0aW9uIGdldExlbmd0aCgpIHtcclxuICAgICAgICByZXR1cm4gbGVuZ3RoO1xyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLmdldE9mZnNldCA9IGZ1bmN0aW9uIGdldE9mZnNldCgpIHtcclxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xyXG4gICAgfTtcclxuICAgICAgICBcclxuICAgIHRoaXMucHVzaFN1YkFycmF5ID0gZnVuY3Rpb24gcHVzaFN1YkFycmF5KHN1YkFycmF5KSB7XHJcbiAgICAgICAgaW50ZXJuYWxQYXJ0cy5wdXNoKHN1YkFycmF5KTtcclxuICAgICAgICBsZW5ndGggKz0gc3ViQXJyYXkubGVuZ3RoO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5jb3B5VG9PdGhlckF0VGhlRW5kID0gZnVuY3Rpb24gY29weVRvT3RoZXJBdFRoZUVuZChyZXN1bHQsIG1pbk9mZnNldCwgbWF4T2Zmc2V0KSB7XHJcbiAgICAgICAgY2hlY2tPZmZzZXRzVG9Db3B5KG1pbk9mZnNldCwgbWF4T2Zmc2V0KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaXRlcmF0b3IgPSBnZXRJbnRlcm5hbFBhcnRzSXRlcmF0b3IobWluT2Zmc2V0LCBtYXhPZmZzZXQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIE5PVEU6IFdoYXQgaWYgZGF0YSBub3QgaW4gZmlyc3QgcGFydD9cclxuICAgICAgICBcclxuICAgICAgICB3aGlsZSAodHJ5QWR2YW5jZUl0ZXJhdG9yKGl0ZXJhdG9yKSkge1xyXG4gICAgICAgICAgICByZXN1bHQucHVzaFN1YkFycmF5KGl0ZXJhdG9yLnN1YkFycmF5KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuY29weVRvVHlwZWRBcnJheSA9IGZ1bmN0aW9uIGNvcHlUb1R5cGVkQXJyYXkoXHJcbiAgICAgICAgcmVzdWx0QXJyYXksIHJlc3VsdEFycmF5T2Zmc2V0LCBtaW5PZmZzZXQsIG1heE9mZnNldCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNoZWNrT2Zmc2V0c1RvQ29weShtaW5PZmZzZXQsIG1heE9mZnNldCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGl0ZXJhdG9yID0gZ2V0SW50ZXJuYWxQYXJ0c0l0ZXJhdG9yKG1pbk9mZnNldCwgbWF4T2Zmc2V0KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBOT1RFOiBXaGF0IGlmIGRhdGEgbm90IGluIGZpcnN0IHBhcnQ/XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKHRyeUFkdmFuY2VJdGVyYXRvcihpdGVyYXRvcikpIHtcclxuICAgICAgICAgICAgdmFyIG9mZnNldEluUmVzdWx0ID1cclxuICAgICAgICAgICAgICAgIGl0ZXJhdG9yLm9mZnNldCAtIHJlc3VsdEFycmF5T2Zmc2V0O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmVzdWx0QXJyYXkuc2V0KGl0ZXJhdG9yLnN1YkFycmF5LCBvZmZzZXRJblJlc3VsdCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLmNvcHlUb0FycmF5ID0gZnVuY3Rpb24gY29weVRvQXJyYXkoXHJcbiAgICAgICAgcmVzdWx0QXJyYXksIHJlc3VsdEFycmF5T2Zmc2V0LCBtaW5PZmZzZXQsIG1heE9mZnNldCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNoZWNrT2Zmc2V0c1RvQ29weShtaW5PZmZzZXQsIG1heE9mZnNldCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGl0ZXJhdG9yID0gZ2V0SW50ZXJuYWxQYXJ0c0l0ZXJhdG9yKG1pbk9mZnNldCwgbWF4T2Zmc2V0KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBOT1RFOiBXaGF0IGlmIGRhdGEgbm90IGluIGZpcnN0IHBhcnQ/XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKHRyeUFkdmFuY2VJdGVyYXRvcihpdGVyYXRvcikpIHtcclxuICAgICAgICAgICAgdmFyIG9mZnNldEluUmVzdWx0ID1cclxuICAgICAgICAgICAgICAgIGl0ZXJhdG9yLm9mZnNldCAtIHJlc3VsdEFycmF5T2Zmc2V0O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBpdGVyYXRvci5zdWJBcnJheS5sZW5ndGg7ICsraikge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0QXJyYXlbb2Zmc2V0SW5SZXN1bHQrK10gPSBpdGVyYXRvci5zdWJBcnJheVtqXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuY29weVRvT3RoZXIgPSBmdW5jdGlvbiBjb3B5VG9PdGhlcihvdGhlcikge1xyXG4gICAgICAgIGlmIChvdGhlci5nZXRPZmZzZXQoKSA+IG9mZnNldCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDb21wb3NpdGVBcnJheTogVHJ5aW5nIHRvIGNvcHkgcGFydCBpbnRvIGEgbGF0dGVyIHBhcnQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG90aGVyRW5kT2Zmc2V0ID0gb3RoZXIuZ2V0T2Zmc2V0KCkgKyBvdGhlci5nZXRMZW5ndGgoKTtcclxuICAgICAgICB2YXIgaXNPdGhlckNvbnRhaW5zVGhpcyA9IG9mZnNldCArIGxlbmd0aCA8PSBvdGhlckVuZE9mZnNldDtcclxuICAgICAgICBpZiAoaXNPdGhlckNvbnRhaW5zVGhpcykge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgLy8gRG8gbm90IG92ZXJyaWRlIGFscmVhZHkgZXhpc3QgZGF0YSAoZm9yIGVmZmljaWVuY3kpXHJcbiAgICAgICAgdmFyIG1pbk9mZnNldCA9IG90aGVyRW5kT2Zmc2V0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpdGVyYXRvciA9IGdldEludGVybmFsUGFydHNJdGVyYXRvcihtaW5PZmZzZXQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghdHJ5QWR2YW5jZUl0ZXJhdG9yKGl0ZXJhdG9yKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDb21wb3NpdGVBcnJheTogQ291bGQgbm90IG1lcmdlIHBhcnRzJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBleHBlY3RlZE9mZnNldFZhbHVlID0gbWluT2Zmc2V0O1xyXG5cclxuICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5vZmZzZXQgIT09IGV4cGVjdGVkT2Zmc2V0VmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdDb21wb3NpdGVBcnJheTogTm9uLWNvbnRpbnVvdXMgdmFsdWUgb2YgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgJ3JhbmdlVG9Db3B5Lm9mZnNldC4gRXhwZWN0ZWQ6ICcgKyBleHBlY3RlZE9mZnNldFZhbHVlICtcclxuICAgICAgICAgICAgICAgICAgICAgJywgQWN0dWFsOiAnICsgaXRlcmF0b3Iub2Zmc2V0KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgb3RoZXIucHVzaFN1YkFycmF5KGl0ZXJhdG9yLnN1YkFycmF5KTtcclxuICAgICAgICAgICAgZXhwZWN0ZWRPZmZzZXRWYWx1ZSArPSBpdGVyYXRvci5zdWJBcnJheS5sZW5ndGg7XHJcbiAgICAgICAgfSB3aGlsZSAodHJ5QWR2YW5jZUl0ZXJhdG9yKGl0ZXJhdG9yKSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjaGVja09mZnNldHNUb0NvcHkobWluT2Zmc2V0LCBtYXhPZmZzZXQpIHtcclxuICAgICAgICBpZiAobWluT2Zmc2V0ID09PSB1bmRlZmluZWQgfHwgbWF4T2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnbWluT2Zmc2V0IG9yIG1heE9mZnNldCBpcyB1bmRlZmluZWQgZm9yIENvbXBvc2l0ZUFycmF5LmNvcHlUb0FycmF5Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChtaW5PZmZzZXQgPCBvZmZzZXQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnbWluT2Zmc2V0ICgnICsgbWluT2Zmc2V0ICsgJykgbXVzdCBiZSBzbWFsbGVyIHRoYW4gJyArXHJcbiAgICAgICAgICAgICAgICAnQ29tcG9zaXRlQXJyYXkgb2Zmc2V0ICgnICsgb2Zmc2V0ICsgJyknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1heE9mZnNldCA+IG9mZnNldCArIGxlbmd0aCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdtYXhPZmZzZXQgKCcgKyBtYXhPZmZzZXQgKyAnKSBtdXN0IGJlIGxhcmdlciB0aGFuICcgK1xyXG4gICAgICAgICAgICAgICAgJ0NvbXBvc2l0ZUFycmF5IGVuZCBvZmZzZXQgKCcgKyBvZmZzZXQgKyBsZW5ndGggKyAnKScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0SW50ZXJuYWxQYXJ0c0l0ZXJhdG9yKG1pbk9mZnNldCwgbWF4T2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIHN0YXJ0ID0gTWF0aC5tYXgob2Zmc2V0LCBtaW5PZmZzZXQpO1xyXG5cclxuICAgICAgICB2YXIgZW5kID0gb2Zmc2V0ICsgbGVuZ3RoO1xyXG4gICAgICAgIGlmIChtYXhPZmZzZXQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBlbmQgPSBNYXRoLm1pbihlbmQsIG1heE9mZnNldCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChzdGFydCA+PSBlbmQpIHtcclxuICAgICAgICAgICAgdmFyIGVtcHR5SXRlcmF0b3IgPSB7XHJcbiAgICAgICAgICAgICAgICBpbnRlcm5hbEl0ZXJhdG9yRGF0YTogeyBpc0VuZE9mUmFuZ2U6IHRydWUgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGVtcHR5SXRlcmF0b3I7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpdGVyYXRvciA9IHtcclxuICAgICAgICAgICAgc3ViQXJyYXk6IG51bGwsXHJcbiAgICAgICAgICAgIG9mZnNldDogLTEsXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpbnRlcm5hbEl0ZXJhdG9yRGF0YToge1xyXG4gICAgICAgICAgICAgICAgZW5kOiBlbmQsXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50U3ViQXJyYXk6IG51bGwsXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50SW50ZXJuYWxQYXJ0T2Zmc2V0OiBudWxsLFxyXG4gICAgICAgICAgICAgICAgbmV4dEludGVybmFsUGFydE9mZnNldDogb2Zmc2V0LFxyXG4gICAgICAgICAgICAgICAgY3VycmVudEludGVybmFsUGFydEluZGV4OiAtMSxcclxuICAgICAgICAgICAgICAgIGlzRW5kT2ZSYW5nZTogZmFsc2VcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGFscmVhZHlSZWFjaGVkVG9UaGVFbmQgPSBmYWxzZTtcclxuICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIGlmIChhbHJlYWR5UmVhY2hlZFRvVGhlRW5kKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbignSXRlcmF0b3IgcmVhY2hlZCAnICtcclxuICAgICAgICAgICAgICAgICAgICAndG8gdGhlIGVuZCBhbHRob3VnaCBubyBkYXRhIGhhcyBiZWVuIGl0ZXJhdGVkJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGFscmVhZHlSZWFjaGVkVG9UaGVFbmQgPSAhdHJ5QWR2YW5jZUl0ZXJhdG9yKGl0ZXJhdG9yKTtcclxuICAgICAgICB9IHdoaWxlIChzdGFydCA+PSBpdGVyYXRvci5pbnRlcm5hbEl0ZXJhdG9yRGF0YS5uZXh0SW50ZXJuYWxQYXJ0T2Zmc2V0KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY3V0Rmlyc3RTdWJBcnJheSA9XHJcbiAgICAgICAgICAgIHN0YXJ0IC0gaXRlcmF0b3IuaW50ZXJuYWxJdGVyYXRvckRhdGEuY3VycmVudEludGVybmFsUGFydE9mZnNldDtcclxuICAgICAgICBpdGVyYXRvci5pbnRlcm5hbEl0ZXJhdG9yRGF0YS5jdXJyZW50U3ViQXJyYXkgPVxyXG4gICAgICAgICAgICBpdGVyYXRvci5pbnRlcm5hbEl0ZXJhdG9yRGF0YS5jdXJyZW50U3ViQXJyYXkuc3ViYXJyYXkoY3V0Rmlyc3RTdWJBcnJheSk7XHJcbiAgICAgICAgaXRlcmF0b3IuaW50ZXJuYWxJdGVyYXRvckRhdGEuY3VycmVudEludGVybmFsUGFydE9mZnNldCA9IHN0YXJ0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBpdGVyYXRvcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gdHJ5QWR2YW5jZUl0ZXJhdG9yKGl0ZXJhdG9yKSB7XHJcbiAgICAgICAgdmFyIGludGVybmFsSXRlcmF0b3JEYXRhID0gaXRlcmF0b3IuaW50ZXJuYWxJdGVyYXRvckRhdGE7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGludGVybmFsSXRlcmF0b3JEYXRhLmlzRW5kT2ZSYW5nZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGl0ZXJhdG9yLnN1YkFycmF5ID0gaW50ZXJuYWxJdGVyYXRvckRhdGEuY3VycmVudFN1YkFycmF5O1xyXG4gICAgICAgIGl0ZXJhdG9yLm9mZnNldCA9IGludGVybmFsSXRlcmF0b3JEYXRhLmN1cnJlbnRJbnRlcm5hbFBhcnRPZmZzZXQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgKytpbnRlcm5hbEl0ZXJhdG9yRGF0YS5jdXJyZW50SW50ZXJuYWxQYXJ0SW5kZXg7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGludGVybmFsSXRlcmF0b3JEYXRhLm5leHRJbnRlcm5hbFBhcnRPZmZzZXQgPj0gaW50ZXJuYWxJdGVyYXRvckRhdGEuZW5kKSB7XHJcbiAgICAgICAgICAgIGludGVybmFsSXRlcmF0b3JEYXRhLmlzRW5kT2ZSYW5nZSA9IHRydWU7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZW5zdXJlTm9FbmRPZkFycmF5UmVhY2hlZChpbnRlcm5hbEl0ZXJhdG9yRGF0YS5jdXJyZW50SW50ZXJuYWxQYXJ0SW5kZXgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGludGVybmFsSXRlcmF0b3JEYXRhLmN1cnJlbnRTdWJBcnJheSA9IGludGVybmFsUGFydHNbXHJcbiAgICAgICAgICAgIGludGVybmFsSXRlcmF0b3JEYXRhLmN1cnJlbnRJbnRlcm5hbFBhcnRJbmRleF07XHJcbiAgICAgICAgaW50ZXJuYWxJdGVyYXRvckRhdGEuY3VycmVudEludGVybmFsUGFydE9mZnNldCA9XHJcbiAgICAgICAgICAgIGludGVybmFsSXRlcmF0b3JEYXRhLm5leHRJbnRlcm5hbFBhcnRPZmZzZXQ7XHJcbiAgICAgICAgdmFyIGN1cnJlbnRJbnRlcm5hbFBhcnRMZW5ndGggPVxyXG4gICAgICAgICAgICBpbnRlcm5hbFBhcnRzW2ludGVybmFsSXRlcmF0b3JEYXRhLmN1cnJlbnRJbnRlcm5hbFBhcnRJbmRleF0ubGVuZ3RoO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGludGVybmFsSXRlcmF0b3JEYXRhLm5leHRJbnRlcm5hbFBhcnRPZmZzZXQgPVxyXG4gICAgICAgICAgICBpbnRlcm5hbEl0ZXJhdG9yRGF0YS5jdXJyZW50SW50ZXJuYWxQYXJ0T2Zmc2V0ICsgY3VycmVudEludGVybmFsUGFydExlbmd0aDtcclxuXHJcbiAgICAgICAgdmFyIGN1dExhc3RTdWJBcnJheSA9XHJcbiAgICAgICAgICAgIGludGVybmFsSXRlcmF0b3JEYXRhLmVuZCAtIGludGVybmFsSXRlcmF0b3JEYXRhLmN1cnJlbnRJbnRlcm5hbFBhcnRPZmZzZXQ7XHJcbiAgICAgICAgdmFyIGlzTGFzdFN1YkFycmF5ID1cclxuICAgICAgICAgICAgY3V0TGFzdFN1YkFycmF5IDwgaW50ZXJuYWxJdGVyYXRvckRhdGEuY3VycmVudFN1YkFycmF5Lmxlbmd0aDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaXNMYXN0U3ViQXJyYXkpIHtcclxuICAgICAgICAgICAgaW50ZXJuYWxJdGVyYXRvckRhdGEuY3VycmVudFN1YkFycmF5ID0gaW50ZXJuYWxJdGVyYXRvckRhdGFcclxuICAgICAgICAgICAgICAgIC5jdXJyZW50U3ViQXJyYXkuc3ViYXJyYXkoMCwgY3V0TGFzdFN1YkFycmF5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGVuc3VyZU5vRW5kT2ZBcnJheVJlYWNoZWQoY3VycmVudEludGVybmFsUGFydEluZGV4KSB7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRJbnRlcm5hbFBhcnRJbmRleCA+PSBpbnRlcm5hbFBhcnRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDb21wb3NpdGVBcnJheTogZW5kIG9mIHBhcnQgaGFzIHJlYWNoZWQuIENoZWNrIGVuZCBjYWxjdWxhdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG4vLyBBLjIuMS5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSnBpcERhdGFiaW5QYXJ0cyhcclxuICAgIGNsYXNzSWQsIGluQ2xhc3NJZCwganBpcEZhY3RvcnkpIHtcclxuXHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIHBhcnRzID0gW107XHJcbiAgICB2YXIgZGF0YWJpbkxlbmd0aElmS25vd24gPSBudWxsO1xyXG4gICAgdmFyIGxvYWRlZEJ5dGVzID0gMDtcclxuICAgIFxyXG4gICAgdmFyIGNhY2hlZERhdGEgPSBbXTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXREYXRhYmluTGVuZ3RoSWZLbm93biA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBkYXRhYmluTGVuZ3RoSWZLbm93bjtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TG9hZGVkQnl0ZXMgPSBmdW5jdGlvbiBnZXRMb2FkZWRCeXRlcygpIHtcclxuICAgICAgICByZXR1cm4gbG9hZGVkQnl0ZXM7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmlzQWxsRGF0YWJpbkxvYWRlZCA9IGZ1bmN0aW9uIGlzQWxsRGF0YWJpbkxvYWRlZCgpIHtcclxuICAgICAgICB2YXIgcmVzdWx0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAocGFydHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNhc2UgMDpcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGRhdGFiaW5MZW5ndGhJZktub3duID09PSAwO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID1cclxuICAgICAgICAgICAgICAgICAgICBwYXJ0c1swXS5nZXRPZmZzZXQoKSA9PT0gMCAmJlxyXG4gICAgICAgICAgICAgICAgICAgIHBhcnRzWzBdLmdldExlbmd0aCgpID09PSBkYXRhYmluTGVuZ3RoSWZLbm93bjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldENhY2hlZERhdGEgPSBmdW5jdGlvbiBnZXRDYWNoZWREYXRhKGtleSkge1xyXG4gICAgICAgIHZhciBvYmogPSBjYWNoZWREYXRhW2tleV07XHJcbiAgICAgICAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIG9iaiA9IHt9O1xyXG4gICAgICAgICAgICBjYWNoZWREYXRhW2tleV0gPSBvYmo7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBvYmo7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldENsYXNzSWQgPSBmdW5jdGlvbiBnZXRDbGFzc0lkKCkge1xyXG4gICAgICAgIHJldHVybiBjbGFzc0lkO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRJbkNsYXNzSWQgPSBmdW5jdGlvbiBnZXRJbkNsYXNzSWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIGluQ2xhc3NJZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuY29weVRvQ29tcG9zaXRlQXJyYXkgPSBmdW5jdGlvbiBjb3B5VG9Db21wb3NpdGVBcnJheShyZXN1bHQsIHJhbmdlT3B0aW9ucykge1xyXG4gICAgICAgIHZhciBkdW1teVJlc3VsdFN0YXJ0T2Zmc2V0ID0gMDtcclxuICAgICAgICB2YXIgcGFyYW1zID0gZ2V0UGFyYW1zRm9yQ29weUJ5dGVzKGR1bW15UmVzdWx0U3RhcnRPZmZzZXQsIHJhbmdlT3B0aW9ucyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHBhcmFtcy5yZXN1bHRXaXRob3V0Q29weSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJhbXMucmVzdWx0V2l0aG91dENvcHk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBtYXhMZW5ndGhDb3BpZWQgPSBpdGVyYXRlUmFuZ2UoXHJcbiAgICAgICAgICAgIHBhcmFtcy5kYXRhYmluU3RhcnRPZmZzZXQsXHJcbiAgICAgICAgICAgIHBhcmFtcy5tYXhMZW5ndGhUb0NvcHksXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFkZFBhcnRUb1Jlc3VsdEluQ29weVRvQ29tcG9zaXRlQXJyYXkocGFydCwgbWluT2Zmc2V0SW5QYXJ0LCBtYXhPZmZzZXRJblBhcnQpIHtcclxuICAgICAgICAgICAgICAgIHBhcnQuY29weVRvT3RoZXJBdFRoZUVuZChcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgICAgICAgICAgICAgbWluT2Zmc2V0SW5QYXJ0LFxyXG4gICAgICAgICAgICAgICAgICAgIG1heE9mZnNldEluUGFydCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXhMZW5ndGhDb3BpZWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmNvcHlCeXRlcyA9IGZ1bmN0aW9uKHJlc3VsdEFycmF5LCByZXN1bHRTdGFydE9mZnNldCwgcmFuZ2VPcHRpb25zKSB7XHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IGdldFBhcmFtc0ZvckNvcHlCeXRlcyhyZXN1bHRTdGFydE9mZnNldCwgcmFuZ2VPcHRpb25zKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAocGFyYW1zLnJlc3VsdFdpdGhvdXRDb3B5ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtcy5yZXN1bHRXaXRob3V0Q29weTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdEFycmF5T2Zmc2V0SW5EYXRhYmluID0gcGFyYW1zLmRhdGFiaW5TdGFydE9mZnNldCAtIHBhcmFtcy5yZXN1bHRTdGFydE9mZnNldDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbWF4TGVuZ3RoQ29waWVkID0gaXRlcmF0ZVJhbmdlKFxyXG4gICAgICAgICAgICBwYXJhbXMuZGF0YWJpblN0YXJ0T2Zmc2V0LFxyXG4gICAgICAgICAgICBwYXJhbXMubWF4TGVuZ3RoVG9Db3B5LFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBhZGRQYXJ0VG9SZXN1bHRJbkNvcHlCeXRlcyhwYXJ0LCBtaW5PZmZzZXRJblBhcnQsIG1heE9mZnNldEluUGFydCkge1xyXG4gICAgICAgICAgICAgICAgcGFydC5jb3B5VG9BcnJheShcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRBcnJheSxcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRBcnJheU9mZnNldEluRGF0YWJpbixcclxuICAgICAgICAgICAgICAgICAgICBtaW5PZmZzZXRJblBhcnQsXHJcbiAgICAgICAgICAgICAgICAgICAgbWF4T2Zmc2V0SW5QYXJ0KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1heExlbmd0aENvcGllZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0RXhpc3RpbmdSYW5nZXMgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KHBhcnRzLmxlbmd0aCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICByZXN1bHRbaV0gPSB7XHJcbiAgICAgICAgICAgICAgICBzdGFydDogcGFydHNbaV0uZ2V0T2Zmc2V0KCksXHJcbiAgICAgICAgICAgICAgICBsZW5ndGg6IHBhcnRzW2ldLmdldExlbmd0aCgpXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5hZGREYXRhID0gZnVuY3Rpb24oaGVhZGVyLCBtZXNzYWdlKSB7XHJcbiAgICAgICAgaWYgKGhlYWRlci5pc0xhc3RCeXRlSW5EYXRhYmluKSB7XHJcbiAgICAgICAgICAgIGRhdGFiaW5MZW5ndGhJZktub3duID0gaGVhZGVyLm1lc3NhZ2VPZmZzZXRGcm9tRGF0YWJpblN0YXJ0ICsgaGVhZGVyLm1lc3NhZ2VCb2R5TGVuZ3RoO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoaGVhZGVyLm1lc3NhZ2VCb2R5TGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBuZXdQYXJ0ID0ganBpcEZhY3RvcnkuY3JlYXRlQ29tcG9zaXRlQXJyYXkoXHJcbiAgICAgICAgICAgIGhlYWRlci5tZXNzYWdlT2Zmc2V0RnJvbURhdGFiaW5TdGFydCk7XHJcblxyXG4gICAgICAgIHZhciBlbmRPZmZzZXRJbk1lc3NhZ2UgPSBoZWFkZXIuYm9keVN0YXJ0ICsgaGVhZGVyLm1lc3NhZ2VCb2R5TGVuZ3RoO1xyXG4gICAgICAgIG5ld1BhcnQucHVzaFN1YkFycmF5KG1lc3NhZ2Uuc3ViYXJyYXkoaGVhZGVyLmJvZHlTdGFydCwgZW5kT2Zmc2V0SW5NZXNzYWdlKSk7XHJcblxyXG4gICAgICAgIC8vIEZpbmQgd2hlcmUgdG8gcHVzaCB0aGUgbmV3IG1lc3NhZ2VcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW5kZXhGaXJzdFBhcnRBZnRlciA9IGZpbmRGaXJzdFBhcnRBZnRlck9mZnNldChoZWFkZXIubWVzc2FnZU9mZnNldEZyb21EYXRhYmluU3RhcnQpO1xyXG4gICAgICAgIHZhciBpbmRleEZpcnN0UGFydE5lYXJPckFmdGVyID0gaW5kZXhGaXJzdFBhcnRBZnRlcjtcclxuXHJcbiAgICAgICAgaWYgKGluZGV4Rmlyc3RQYXJ0QWZ0ZXIgPiAwKSB7XHJcbiAgICAgICAgICAgIHZhciBwcmV2aW91c1BhcnQgPSBwYXJ0c1tpbmRleEZpcnN0UGFydEFmdGVyIC0gMV07XHJcbiAgICAgICAgICAgIHZhciBwcmV2aW91c1BhcnRFbmRPZmZzZXQgPVxyXG4gICAgICAgICAgICAgICAgcHJldmlvdXNQYXJ0LmdldE9mZnNldCgpICsgcHJldmlvdXNQYXJ0LmdldExlbmd0aCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHByZXZpb3VzUGFydEVuZE9mZnNldCA9PT0gaGVhZGVyLm1lc3NhZ2VPZmZzZXRGcm9tRGF0YWJpblN0YXJ0KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBDYW4gbWVyZ2UgYWxzbyBwcmV2aW91cyBwYXJ0XHJcbiAgICAgICAgICAgICAgICAtLWluZGV4Rmlyc3RQYXJ0TmVhck9yQWZ0ZXI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpbmRleEZpcnN0UGFydE5lYXJPckFmdGVyID49IHBhcnRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBwYXJ0cy5wdXNoKG5ld1BhcnQpO1xyXG4gICAgICAgICAgICBsb2FkZWRCeXRlcyArPSBoZWFkZXIubWVzc2FnZUJvZHlMZW5ndGg7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBmaXJzdFBhcnROZWFyT3JBZnRlciA9IHBhcnRzW2luZGV4Rmlyc3RQYXJ0TmVhck9yQWZ0ZXJdO1xyXG4gICAgICAgIHZhciBlbmRPZmZzZXRJbkRhdGFiaW4gPVxyXG4gICAgICAgICAgICBoZWFkZXIubWVzc2FnZU9mZnNldEZyb21EYXRhYmluU3RhcnQgKyBoZWFkZXIubWVzc2FnZUJvZHlMZW5ndGg7XHJcbiAgICAgICAgaWYgKGZpcnN0UGFydE5lYXJPckFmdGVyLmdldE9mZnNldCgpID4gZW5kT2Zmc2V0SW5EYXRhYmluKSB7XHJcbiAgICAgICAgICAgIC8vIE5vdCBmb3VuZCBhbiBvdmVybGFwcGluZyBwYXJ0LCBwdXNoIGEgbmV3XHJcbiAgICAgICAgICAgIC8vIHBhcnQgaW4gdGhlIG1pZGRsZSBvZiB0aGUgcGFydHMgYXJyYXlcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gcGFydHMubGVuZ3RoOyBpID4gaW5kZXhGaXJzdFBhcnROZWFyT3JBZnRlcjsgLS1pKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJ0c1tpXSA9IHBhcnRzW2kgLSAxXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcGFydHNbaW5kZXhGaXJzdFBhcnROZWFyT3JBZnRlcl0gPSBuZXdQYXJ0O1xyXG4gICAgICAgICAgICBsb2FkZWRCeXRlcyArPSBoZWFkZXIubWVzc2FnZUJvZHlMZW5ndGg7XHJcblxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIE1lcmdlIGZpcnN0IGFuZCBsYXN0IG92ZXJsYXBwaW5nIHBhcnRzIC0gYWxsIHRoZSByZXN0IChpZiBhbnkpIGFyZSBpbiB0aGUgbWlkZGxlIG9mIHRoZSBuZXcgcGFydFxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBieXRlc0FscmVhZHlTYXZlZCA9IGZpcnN0UGFydE5lYXJPckFmdGVyLmdldExlbmd0aCgpO1xyXG5cclxuICAgICAgICB2YXIgc2hvdWxkU3dhcCA9XHJcbiAgICAgICAgICAgIGZpcnN0UGFydE5lYXJPckFmdGVyLmdldE9mZnNldCgpID4gaGVhZGVyLm1lc3NhZ2VPZmZzZXRGcm9tRGF0YWJpblN0YXJ0O1xyXG4gICAgICAgIGlmIChzaG91bGRTd2FwKSB7XHJcbiAgICAgICAgICAgIHBhcnRzW2luZGV4Rmlyc3RQYXJ0TmVhck9yQWZ0ZXJdID0gbmV3UGFydDtcclxuICAgICAgICAgICAgbmV3UGFydCA9IGZpcnN0UGFydE5lYXJPckFmdGVyO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZmlyc3RQYXJ0TmVhck9yQWZ0ZXIgPSBwYXJ0c1tpbmRleEZpcnN0UGFydE5lYXJPckFmdGVyXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5ld1BhcnQuY29weVRvT3RoZXIoZmlyc3RQYXJ0TmVhck9yQWZ0ZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBlbmRPZmZzZXQgPVxyXG4gICAgICAgICAgICBmaXJzdFBhcnROZWFyT3JBZnRlci5nZXRPZmZzZXQoKSArIGZpcnN0UGFydE5lYXJPckFmdGVyLmdldExlbmd0aCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwYXJ0VG9NZXJnZUluZGV4O1xyXG4gICAgICAgIGZvciAocGFydFRvTWVyZ2VJbmRleCA9IGluZGV4Rmlyc3RQYXJ0TmVhck9yQWZ0ZXI7XHJcbiAgICAgICAgICAgIHBhcnRUb01lcmdlSW5kZXggPCBwYXJ0cy5sZW5ndGggLSAxO1xyXG4gICAgICAgICAgICArK3BhcnRUb01lcmdlSW5kZXgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChlbmRPZmZzZXQgPCBwYXJ0c1twYXJ0VG9NZXJnZUluZGV4ICsgMV0uZ2V0T2Zmc2V0KCkpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBieXRlc0FscmVhZHlTYXZlZCArPSBwYXJ0c1twYXJ0VG9NZXJnZUluZGV4ICsgMV0uZ2V0TGVuZ3RoKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwYXJ0c1RvRGVsZXRlID0gcGFydFRvTWVyZ2VJbmRleCAtIGluZGV4Rmlyc3RQYXJ0TmVhck9yQWZ0ZXI7XHJcbiAgICAgICAgaWYgKHBhcnRzVG9EZWxldGUgPiAwKSB7XHJcbiAgICAgICAgICAgIHBhcnRzW3BhcnRUb01lcmdlSW5kZXhdLmNvcHlUb090aGVyKGZpcnN0UGFydE5lYXJPckFmdGVyKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIERlbGV0ZSBhbGwgbWlkZGxlIGFuZCBtZXJnZWQgcGFydHMgZXhjZXB0IDFcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZvciAodmFyIGogPSBpbmRleEZpcnN0UGFydE5lYXJPckFmdGVyICsgMTsgaiA8IHBhcnRzLmxlbmd0aCAtIHBhcnRzVG9EZWxldGU7ICsraikge1xyXG4gICAgICAgICAgICAgICAgcGFydHNbal0gPSBwYXJ0c1tqICsgcGFydHNUb0RlbGV0ZV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHBhcnRzLmxlbmd0aCAtPSBwYXJ0c1RvRGVsZXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsb2FkZWRCeXRlcyArPSBmaXJzdFBhcnROZWFyT3JBZnRlci5nZXRMZW5ndGgoKSAtIGJ5dGVzQWxyZWFkeVNhdmVkO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0UGFyYW1zRm9yQ29weUJ5dGVzKHJlc3VsdFN0YXJ0T2Zmc2V0LCByYW5nZU9wdGlvbnMpIHtcclxuICAgICAgICB2YXIgZm9yY2VDb3B5QWxsUmFuZ2UgPSBmYWxzZTtcclxuICAgICAgICB2YXIgZGF0YWJpblN0YXJ0T2Zmc2V0ID0gMDtcclxuICAgICAgICB2YXIgbWF4TGVuZ3RoVG9Db3B5O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChyYW5nZU9wdGlvbnMgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBmb3JjZUNvcHlBbGxSYW5nZSA9ICEhcmFuZ2VPcHRpb25zLmZvcmNlQ29weUFsbFJhbmdlO1xyXG4gICAgICAgICAgICBkYXRhYmluU3RhcnRPZmZzZXQgPSByYW5nZU9wdGlvbnMuZGF0YWJpblN0YXJ0T2Zmc2V0O1xyXG4gICAgICAgICAgICBtYXhMZW5ndGhUb0NvcHkgPSByYW5nZU9wdGlvbnMubWF4TGVuZ3RoVG9Db3B5O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGRhdGFiaW5TdGFydE9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhYmluU3RhcnRPZmZzZXQgPSAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChyZXN1bHRTdGFydE9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdFN0YXJ0T2Zmc2V0ID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1heExlbmd0aFRvQ29weSA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4geyByZXN1bHRXaXRob3V0Q29weTogMCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoKGRhdGFiaW5MZW5ndGhJZktub3duICE9PSBudWxsKSAmJiAoZGF0YWJpblN0YXJ0T2Zmc2V0ID49IGRhdGFiaW5MZW5ndGhJZktub3duKSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyByZXN1bHRXaXRob3V0Q29weTogKCEhbWF4TGVuZ3RoVG9Db3B5ICYmIGZvcmNlQ29weUFsbFJhbmdlID8gbnVsbCA6IDApIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBmaXJzdFJlbGV2YW50UGFydEluZGV4ID0gZmluZEZpcnN0UGFydEFmdGVyT2Zmc2V0KGRhdGFiaW5TdGFydE9mZnNldCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGZpcnN0UmVsZXZhbnRQYXJ0SW5kZXggPT09IHBhcnRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4geyByZXN1bHRXaXRob3V0Q29weTogKGZvcmNlQ29weUFsbFJhbmdlID8gbnVsbCA6IDApIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChmb3JjZUNvcHlBbGxSYW5nZSkge1xyXG4gICAgICAgICAgICB2YXIgaXNBbGxSZXF1ZXN0ZWRSYW5nZUV4aXN0ID1cclxuICAgICAgICAgICAgICAgIGlzQWxsUmFuZ2VFeGlzdChkYXRhYmluU3RhcnRPZmZzZXQsIG1heExlbmd0aFRvQ29weSwgZmlyc3RSZWxldmFudFBhcnRJbmRleCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWlzQWxsUmVxdWVzdGVkUmFuZ2VFeGlzdCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcmVzdWx0V2l0aG91dENvcHk6IG51bGwgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBkYXRhYmluU3RhcnRPZmZzZXQ6IGRhdGFiaW5TdGFydE9mZnNldCxcclxuICAgICAgICAgICAgbWF4TGVuZ3RoVG9Db3B5OiBtYXhMZW5ndGhUb0NvcHksXHJcbiAgICAgICAgICAgIHJlc3VsdFN0YXJ0T2Zmc2V0OiByZXN1bHRTdGFydE9mZnNldFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBwYXJhbXM7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGlzQWxsUmFuZ2VFeGlzdChcclxuICAgICAgICBkYXRhYmluU3RhcnRPZmZzZXQsIG1heExlbmd0aFRvQ29weSwgZmlyc3RSZWxldmFudFBhcnRJbmRleCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChwYXJ0c1tmaXJzdFJlbGV2YW50UGFydEluZGV4XS5nZXRPZmZzZXQoKSA+IGRhdGFiaW5TdGFydE9mZnNldCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChtYXhMZW5ndGhUb0NvcHkpIHtcclxuICAgICAgICAgICAgdmFyIHVudXNlZEVsZW1lbnRzID1cclxuICAgICAgICAgICAgICAgIGRhdGFiaW5TdGFydE9mZnNldCAtIHBhcnRzW2ZpcnN0UmVsZXZhbnRQYXJ0SW5kZXhdLmdldE9mZnNldCgpO1xyXG4gICAgICAgICAgICB2YXIgYXZhaWxhYmxlTGVuZ3RoID1cclxuICAgICAgICAgICAgICAgIHBhcnRzW2ZpcnN0UmVsZXZhbnRQYXJ0SW5kZXhdLmdldExlbmd0aCgpIC0gdW51c2VkRWxlbWVudHM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgaXNVbnRpbE1heExlbmd0aEV4aXN0ID0gYXZhaWxhYmxlTGVuZ3RoID49IG1heExlbmd0aFRvQ29weTtcclxuICAgICAgICAgICAgcmV0dXJuIGlzVW50aWxNYXhMZW5ndGhFeGlzdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGRhdGFiaW5MZW5ndGhJZktub3duID09PSBudWxsIHx8XHJcbiAgICAgICAgICAgIGZpcnN0UmVsZXZhbnRQYXJ0SW5kZXggPCBwYXJ0cy5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsYXN0UGFydCA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgIHZhciBlbmRPZmZzZXRSZWNpZXZlZCA9IGxhc3RQYXJ0LmdldE9mZnNldCgpICsgbGFzdFBhcnQuZ2V0TGVuZ3RoKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGlzVW50aWxFbmRPZkRhdGFiaW5FeGlzdCA9IGVuZE9mZnNldFJlY2lldmVkID09PSBkYXRhYmluTGVuZ3RoSWZLbm93bjtcclxuICAgICAgICByZXR1cm4gaXNVbnRpbEVuZE9mRGF0YWJpbkV4aXN0O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBpdGVyYXRlUmFuZ2UoXHJcbiAgICAgICAgICAgIGRhdGFiaW5TdGFydE9mZnNldCxcclxuICAgICAgICAgICAgbWF4TGVuZ3RoVG9Db3B5LFxyXG4gICAgICAgIGFkZFN1YlBhcnRUb1Jlc3VsdCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBtaW5PZmZzZXRJbkRhdGFiaW5Ub0NvcHkgPSBkYXRhYmluU3RhcnRPZmZzZXQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1heE9mZnNldEluRGF0YWJpblRvQ29weTtcclxuICAgICAgICBpZiAobWF4TGVuZ3RoVG9Db3B5ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgbWF4T2Zmc2V0SW5EYXRhYmluVG9Db3B5ID0gZGF0YWJpblN0YXJ0T2Zmc2V0ICsgbWF4TGVuZ3RoVG9Db3B5O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBsYXN0UGFydCA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgICAgICBtYXhPZmZzZXRJbkRhdGFiaW5Ub0NvcHkgPSBsYXN0UGFydC5nZXRPZmZzZXQoKSArIGxhc3RQYXJ0LmdldExlbmd0aCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHZhciBsYXN0Q29waWVkUGFydCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBpZiAocGFydHNbaV0uZ2V0T2Zmc2V0KCkgPj0gbWF4T2Zmc2V0SW5EYXRhYmluVG9Db3B5KSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGN1cnJlbnRNaW5PZmZzZXRJbkRhdGFiaW5Ub0NvcHkgPSBNYXRoLm1heChcclxuICAgICAgICAgICAgICAgIG1pbk9mZnNldEluRGF0YWJpblRvQ29weSwgcGFydHNbaV0uZ2V0T2Zmc2V0KCkpO1xyXG4gICAgICAgICAgICB2YXIgY3VycmVudE1heE9mZnNldEluRGF0YWJpblRvQ29weSA9IE1hdGgubWluKFxyXG4gICAgICAgICAgICAgICAgbWF4T2Zmc2V0SW5EYXRhYmluVG9Db3B5LCBwYXJ0c1tpXS5nZXRPZmZzZXQoKSArIHBhcnRzW2ldLmdldExlbmd0aCgpKTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgYWRkU3ViUGFydFRvUmVzdWx0KFxyXG4gICAgICAgICAgICAgICAgcGFydHNbaV0sXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50TWluT2Zmc2V0SW5EYXRhYmluVG9Db3B5LFxyXG4gICAgICAgICAgICAgICAgY3VycmVudE1heE9mZnNldEluRGF0YWJpblRvQ29weSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsYXN0Q29waWVkUGFydCA9IHBhcnRzW2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAobGFzdENvcGllZFBhcnQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsYXN0T2Zmc2V0Q29waWVkID0gTWF0aC5taW4oXHJcbiAgICAgICAgICAgIGxhc3RDb3BpZWRQYXJ0LmdldE9mZnNldCgpICsgbGFzdENvcGllZFBhcnQuZ2V0TGVuZ3RoKCksXHJcbiAgICAgICAgICAgIG1heE9mZnNldEluRGF0YWJpblRvQ29weSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1heExlbmd0aENvcGllZCA9IGxhc3RPZmZzZXRDb3BpZWQgLSBkYXRhYmluU3RhcnRPZmZzZXQ7XHJcbiAgICAgICAgcmV0dXJuIG1heExlbmd0aENvcGllZDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBmaW5kRmlyc3RQYXJ0QWZ0ZXJPZmZzZXQob2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIGluZGV4O1xyXG4gICAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IHBhcnRzLmxlbmd0aDsgKytpbmRleCkge1xyXG4gICAgICAgICAgICBpZiAocGFydHNbaW5kZXhdLmdldE9mZnNldCgpICsgcGFydHNbaW5kZXhdLmdldExlbmd0aCgpID4gb2Zmc2V0KSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzO1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSnBpcERhdGFiaW5zU2F2ZXIoaXNKcGlwVGlsZVBhcnRTdHJlYW0sIGpwaXBGYWN0b3J5KSB7XHJcbiAgICB2YXIgUFJFQ0lOQ1RfTk9fQVVYX0NMQVNTID0gMDtcclxuICAgIHZhciBQUkVDSU5DVF9XSVRIX0FVWF9DTEFTUyA9IDE7XHJcbiAgICB2YXIgVElMRV9IRUFERVJfQ0xBU1MgPSAyO1xyXG4gICAgdmFyIFRJTEVfTk9fQVVYX0NMQVNTID0gNDtcclxuICAgIHZhciBUSUxFX1dJVEhfQVVYX0NMQVNTID0gNTtcclxuXHJcbiAgICB2YXIgZGF0YWJpbnNCeUNsYXNzID0gW107XHJcbiAgICB2YXIgZm9yYmlkZGVuSW5KcHAgPSBbXTtcclxuICAgIHZhciBmb3JiaWRkZW5JbkpwdCA9IFtdO1xyXG4gICAgXHJcbiAgICB2YXIgbG9hZGVkQnl0ZXMgPSAwO1xyXG4gICAgdmFyIGxvYWRlZEJ5dGVzSW5SZWdpc3RlcmVkRGF0YWJpbnMgPSAwO1xyXG5cclxuICAgIC8vIFZhbGlkIG9ubHkgaWYgaXNKcGlwVGlsZVBhcnRTdHJlYW0gPSBmYWxzZVxyXG4gICAgXHJcbiAgICBkYXRhYmluc0J5Q2xhc3NbVElMRV9IRUFERVJfQ0xBU1NdID0gY3JlYXRlRGF0YWJpbnNBcnJheSgpO1xyXG4gICAgZGF0YWJpbnNCeUNsYXNzW1BSRUNJTkNUX05PX0FVWF9DTEFTU10gPSBjcmVhdGVEYXRhYmluc0FycmF5KCk7XHJcbiAgICBkYXRhYmluc0J5Q2xhc3NbUFJFQ0lOQ1RfV0lUSF9BVVhfQ0xBU1NdID0gZGF0YWJpbnNCeUNsYXNzW1xyXG4gICAgICAgIFBSRUNJTkNUX05PX0FVWF9DTEFTU107XHJcbiAgICBcclxuICAgIGZvcmJpZGRlbkluSnB0W1RJTEVfSEVBREVSX0NMQVNTXSA9IHRydWU7XHJcbiAgICBmb3JiaWRkZW5JbkpwdFtQUkVDSU5DVF9OT19BVVhfQ0xBU1NdID0gdHJ1ZTtcclxuICAgIGZvcmJpZGRlbkluSnB0W1BSRUNJTkNUX1dJVEhfQVVYX0NMQVNTXSA9IHRydWU7XHJcbiAgICBcclxuICAgIC8vIFZhbGlkIG9ubHkgaWYgaXNKcGlwVGlsZVBhcnRTdHJlYW0gPSB0cnVlXHJcblxyXG4gICAgZGF0YWJpbnNCeUNsYXNzW1RJTEVfTk9fQVVYX0NMQVNTXSA9IGNyZWF0ZURhdGFiaW5zQXJyYXkoKTtcclxuICAgIGRhdGFiaW5zQnlDbGFzc1tUSUxFX1dJVEhfQVVYX0NMQVNTXSA9IGRhdGFiaW5zQnlDbGFzc1tcclxuICAgICAgICBUSUxFX05PX0FVWF9DTEFTU107XHJcbiAgICBcclxuICAgIGZvcmJpZGRlbkluSnBwW1RJTEVfTk9fQVVYX0NMQVNTXSA9IHRydWU7XHJcbiAgICBmb3JiaWRkZW5JbkpwcFtUSUxFX1dJVEhfQVVYX0NMQVNTXSA9IHRydWU7XHJcbiAgICBcclxuICAgIHZhciBtYWluSGVhZGVyRGF0YWJpbiA9IGpwaXBGYWN0b3J5LmNyZWF0ZURhdGFiaW5QYXJ0cyg2LCAwKTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRJc0pwaXBUaWxlUGFydFN0cmVhbSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBpc0pwaXBUaWxlUGFydFN0cmVhbTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TG9hZGVkQnl0ZXMgPSBmdW5jdGlvbiBnZXRMb2FkZWRCeXRlcygpIHtcclxuICAgICAgICByZXR1cm4gbG9hZGVkQnl0ZXM7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuZ2V0TWFpbkhlYWRlckRhdGFiaW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIG1haW5IZWFkZXJEYXRhYmluO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRUaWxlSGVhZGVyRGF0YWJpbiA9IGZ1bmN0aW9uKGluQ2xhc3NJbmRleCkge1xyXG4gICAgICAgIHZhciBkYXRhYmluID0gZ2V0RGF0YWJpbkZyb21BcnJheShcclxuICAgICAgICAgICAgZGF0YWJpbnNCeUNsYXNzW1RJTEVfSEVBREVSX0NMQVNTXSxcclxuICAgICAgICAgICAgVElMRV9IRUFERVJfQ0xBU1MsXHJcbiAgICAgICAgICAgIGluQ2xhc3NJbmRleCxcclxuICAgICAgICAgICAgLyppc0pwaXBUaWxlUGFydFN0cmVhbUV4cGVjdGVkPSovZmFsc2UsXHJcbiAgICAgICAgICAgICd0aWxlSGVhZGVyJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRhdGFiaW47XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFByZWNpbmN0RGF0YWJpbiA9IGZ1bmN0aW9uKGluQ2xhc3NJbmRleCkge1xyXG4gICAgICAgIHZhciBkYXRhYmluID0gZ2V0RGF0YWJpbkZyb21BcnJheShcclxuICAgICAgICAgICAgZGF0YWJpbnNCeUNsYXNzW1BSRUNJTkNUX05PX0FVWF9DTEFTU10sXHJcbiAgICAgICAgICAgIFBSRUNJTkNUX05PX0FVWF9DTEFTUyxcclxuICAgICAgICAgICAgaW5DbGFzc0luZGV4LFxyXG4gICAgICAgICAgICAvKmlzSnBpcFRpbGVQYXJ0U3RyZWFtRXhwZWN0ZWQ9Ki9mYWxzZSxcclxuICAgICAgICAgICAgJ3ByZWNpbmN0Jyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRhdGFiaW47XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFRpbGVEYXRhYmluID0gZnVuY3Rpb24oaW5DbGFzc0luZGV4KSB7XHJcbiAgICAgICAgdmFyIGRhdGFiaW4gPSBnZXREYXRhYmluRnJvbUFycmF5KFxyXG4gICAgICAgICAgICBkYXRhYmluc0J5Q2xhc3NbVElMRV9OT19BVVhfQ0xBU1NdLFxyXG4gICAgICAgICAgICBUSUxFX05PX0FVWF9DTEFTUyxcclxuICAgICAgICAgICAgaW5DbGFzc0luZGV4LFxyXG4gICAgICAgICAgICAvKmlzSnBpcFRpbGVQYXJ0U3RyZWFtRXhwZWN0ZWQ9Ki90cnVlLFxyXG4gICAgICAgICAgICAndGlsZVBhcnQnKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZGF0YWJpbjtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIoXHJcbiAgICAgICAgZGF0YWJpbiwgZXZlbnQsIGxpc3RlbmVyLCBsaXN0ZW5lclRoaXMpIHtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoZXZlbnQgIT09ICdkYXRhQXJyaXZlZCcpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oJ1Vuc3VwcG9ydGVkIGV2ZW50OiAnICtcclxuICAgICAgICAgICAgICAgIGV2ZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNsYXNzSWQgPSBkYXRhYmluLmdldENsYXNzSWQoKTtcclxuICAgICAgICB2YXIgaW5DbGFzc0lkID0gZGF0YWJpbi5nZXRJbkNsYXNzSWQoKTtcclxuICAgICAgICB2YXIgZGF0YWJpbnNBcnJheSA9IGRhdGFiaW5zQnlDbGFzc1tjbGFzc0lkXTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoZGF0YWJpbiAhPT0gZGF0YWJpbnNBcnJheS5kYXRhYmluc1tpbkNsYXNzSWRdKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKCdVbm1hdGNoZWQgZGF0YWJpbiAnICtcclxuICAgICAgICAgICAgICAgICd3aXRoIGNsYXNzLUlEPScgKyBjbGFzc0lkICsgJyBhbmQgaW4tY2xhc3MtSUQ9JyArIGluQ2xhc3NJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChkYXRhYmluc0FycmF5Lmxpc3RlbmVyc1tpbkNsYXNzSWRdID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgZGF0YWJpbnNBcnJheS5saXN0ZW5lcnNbaW5DbGFzc0lkXSA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoZGF0YWJpbnNBcnJheS5saXN0ZW5lcnNbaW5DbGFzc0lkXS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgbG9hZGVkQnl0ZXNJblJlZ2lzdGVyZWREYXRhYmlucyArPSBkYXRhYmluLmdldExvYWRlZEJ5dGVzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGRhdGFiaW5zQXJyYXkubGlzdGVuZXJzW2luQ2xhc3NJZF0ucHVzaCh7XHJcbiAgICAgICAgICAgIGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuICAgICAgICAgICAgbGlzdGVuZXJUaGlzOiBsaXN0ZW5lclRoaXMsXHJcbiAgICAgICAgICAgIGlzUmVnaXN0ZXJlZDogdHJ1ZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBkYXRhYmluc0FycmF5LmRhdGFiaW5zV2l0aExpc3RlbmVyc1tpbkNsYXNzSWRdID0gZGF0YWJpbjtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIHJlbW92ZUV2ZW50TGlzdGVuZXIoXHJcbiAgICAgICAgZGF0YWJpbiwgZXZlbnQsIGxpc3RlbmVyKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGV2ZW50ICE9PSAnZGF0YUFycml2ZWQnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKCdVbnN1cHBvcnRlZCBldmVudDogJyArXHJcbiAgICAgICAgICAgICAgICBldmVudCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY2xhc3NJZCA9IGRhdGFiaW4uZ2V0Q2xhc3NJZCgpO1xyXG4gICAgICAgIHZhciBpbkNsYXNzSWQgPSBkYXRhYmluLmdldEluQ2xhc3NJZCgpO1xyXG4gICAgICAgIHZhciBkYXRhYmluc0FycmF5ID0gZGF0YWJpbnNCeUNsYXNzW2NsYXNzSWRdO1xyXG4gICAgICAgIHZhciBsaXN0ZW5lcnMgPSBkYXRhYmluc0FycmF5Lmxpc3RlbmVyc1tpbkNsYXNzSWRdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChkYXRhYmluICE9PSBkYXRhYmluc0FycmF5LmRhdGFiaW5zW2luQ2xhc3NJZF0gfHxcclxuICAgICAgICAgICAgZGF0YWJpbiAhPT0gZGF0YWJpbnNBcnJheS5kYXRhYmluc1dpdGhMaXN0ZW5lcnNbaW5DbGFzc0lkXSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oJ1VubWF0Y2hlZCBkYXRhYmluICcgK1xyXG4gICAgICAgICAgICAgICAgJ3dpdGggY2xhc3MtSUQ9JyArIGNsYXNzSWQgKyAnIGFuZCBpbi1jbGFzcy1JRD0nICsgaW5DbGFzc0lkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgaWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVyc1tpXS5pc1JlZ2lzdGVyZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzW2ldID0gbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVycy5sZW5ndGggLT0gMTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGxpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YWJpbnNBcnJheS5kYXRhYmluc1dpdGhMaXN0ZW5lcnNbaW5DbGFzc0lkXTtcclxuICAgICAgICAgICAgICAgICAgICBsb2FkZWRCeXRlc0luUmVnaXN0ZXJlZERhdGFiaW5zIC09IGRhdGFiaW4uZ2V0TG9hZGVkQnl0ZXMoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAnQ291bGQgbm90IHVucmVnaXN0ZXIgbGlzdGVuZXIgZnJvbSBkYXRhYmluJyk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmNsZWFudXBVbnJlZ2lzdGVyZWREYXRhYmlucyA9IGZ1bmN0aW9uIGNsZWFudXBVbnJlZ2lzdGVyZWREYXRhYmlucygpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFiaW5zQnlDbGFzcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBpZiAoZGF0YWJpbnNCeUNsYXNzW2ldID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgZGF0YWJpbnMgPSBkYXRhYmluc0J5Q2xhc3NbaV0uZGF0YWJpbnNXaXRoTGlzdGVuZXJzO1xyXG4gICAgICAgICAgICBkYXRhYmluc0J5Q2xhc3NbaV0uZGF0YWJpbnMgPSBkYXRhYmlucy5zbGljZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsb2FkZWRCeXRlcyA9IGxvYWRlZEJ5dGVzSW5SZWdpc3RlcmVkRGF0YWJpbnM7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2F2ZURhdGEgPSBmdW5jdGlvbiAoaGVhZGVyLCBtZXNzYWdlKSB7XHJcbiAgICAgICAgLy8gQS4yLjJcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaGVhZGVyLmNvZGVzdHJlYW1JbmRleCAhPT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ05vbiB6ZXJvIENzbiAoQ29kZSBTdHJlYW0gSW5kZXgpJywgJ0EuMi4yJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAoaGVhZGVyLmNsYXNzSWQpIHtcclxuICAgICAgICAgICAgY2FzZSA2OlxyXG4gICAgICAgICAgICAgICAgc2F2ZU1haW5IZWFkZXIoaGVhZGVyLCBtZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgODpcclxuICAgICAgICAgICAgICAgIHNhdmVNZXRhZGF0YShoZWFkZXIsIG1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgLy8gQS4zLjIsIEEuMy4zLCBBLjMuNFxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgZGF0YWJpbnNBcnJheSA9IGRhdGFiaW5zQnlDbGFzc1toZWFkZXIuY2xhc3NJZF07XHJcbiAgICAgICAgICAgICAgICBpZiAoZGF0YWJpbnNBcnJheSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7IC8vIEEuMi4yXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBpc0pwdEV4cGVjdGVkID0gISFmb3JiaWRkZW5JbkpwcFtoZWFkZXIuY2xhc3NJZF07XHJcbiAgICAgICAgICAgICAgICB2YXIgZGF0YWJpbiA9IGdldERhdGFiaW5Gcm9tQXJyYXkoXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YWJpbnNBcnJheSxcclxuICAgICAgICAgICAgICAgICAgICBoZWFkZXIuY2xhc3NJZCxcclxuICAgICAgICAgICAgICAgICAgICBoZWFkZXIuaW5DbGFzc0lkLFxyXG4gICAgICAgICAgICAgICAgICAgIGlzSnB0RXhwZWN0ZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgJzxjbGFzcyBJRCAnICsgaGVhZGVyLmNsYXNzSWQgKyAnPicpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgYnl0ZXNCZWZvcmUgPSBkYXRhYmluLmdldExvYWRlZEJ5dGVzKCk7XHJcbiAgICAgICAgICAgICAgICBkYXRhYmluLmFkZERhdGEoaGVhZGVyLCBtZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIHZhciBieXRlc0RpZmZlcmVuY2UgPSBkYXRhYmluLmdldExvYWRlZEJ5dGVzKCkgLSBieXRlc0JlZm9yZTtcclxuICAgICAgICAgICAgICAgIGxvYWRlZEJ5dGVzICs9IGJ5dGVzRGlmZmVyZW5jZTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IGRhdGFiaW5zQXJyYXkubGlzdGVuZXJzO1xyXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFiaW5MaXN0ZW5lcnMgPSBsaXN0ZW5lcnNbaGVhZGVyLmluQ2xhc3NJZF07XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChkYXRhYmluTGlzdGVuZXJzICE9PSB1bmRlZmluZWQgJiYgZGF0YWJpbkxpc3RlbmVycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbG9hZGVkQnl0ZXNJblJlZ2lzdGVyZWREYXRhYmlucyArPSBieXRlc0RpZmZlcmVuY2U7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxvY2FsTGlzdGVuZXJzID0gZGF0YWJpbkxpc3RlbmVycy5zbGljZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxMaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbG9jYWxMaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaXN0ZW5lci5pc1JlZ2lzdGVyZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyLmNhbGwobGlzdGVuZXIubGlzdGVuZXJUaGlzLCBkYXRhYmluKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2F2ZU1haW5IZWFkZXIoaGVhZGVyLCBtZXNzYWdlKSB7XHJcbiAgICAgICAgLy8gQS4zLjVcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaGVhZGVyLmluQ2xhc3NJZCAhPT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oJ01haW4gaGVhZGVyIGRhdGEtYmluIHdpdGggJyArXHJcbiAgICAgICAgICAgICAgICAnaW4tY2xhc3MgaW5kZXggb3RoZXIgdGhhbiB6ZXJvIGlzIG5vdCB2YWxpZCcsICdBLjMuNScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXNCZWZvcmUgPSBtYWluSGVhZGVyRGF0YWJpbi5nZXRMb2FkZWRCeXRlcygpO1xyXG4gICAgICAgIG1haW5IZWFkZXJEYXRhYmluLmFkZERhdGEoaGVhZGVyLCBtZXNzYWdlKTtcclxuICAgICAgICB2YXIgYnl0ZXNEaWZmZXJlbmNlID0gbWFpbkhlYWRlckRhdGFiaW4uZ2V0TG9hZGVkQnl0ZXMoKSAtIGJ5dGVzQmVmb3JlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxvYWRlZEJ5dGVzICs9IGJ5dGVzRGlmZmVyZW5jZTtcclxuICAgICAgICBsb2FkZWRCeXRlc0luUmVnaXN0ZXJlZERhdGFiaW5zICs9IGJ5dGVzRGlmZmVyZW5jZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2F2ZU1ldGFkYXRhKGhlYWRlciwgbWVzc2FnZSkge1xyXG4gICAgICAgIC8vIEEuMy42XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLlVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbigncmVjaWV2ZSBtZXRhZGF0YS1iaW4nLCAnQS4zLjYnKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBpZ25vcmUgdW51c2VkIG1ldGFkYXRhIChsZWdhbCBhY2NvcmRpbmcgdG8gQS4yLjIpLlxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXREYXRhYmluRnJvbUFycmF5KFxyXG4gICAgICAgIGRhdGFiaW5zQXJyYXksXHJcbiAgICAgICAgY2xhc3NJZCxcclxuICAgICAgICBpbkNsYXNzSWQsXHJcbiAgICAgICAgaXNKcGlwVGlsZVBhcnRTdHJlYW1FeHBlY3RlZCxcclxuICAgICAgICBkYXRhYmluVHlwZURlc2NyaXB0aW9uKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGlzSnBpcFRpbGVQYXJ0U3RyZWFtRXhwZWN0ZWQgIT09IGlzSnBpcFRpbGVQYXJ0U3RyZWFtKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5Xcm9uZ1N0cmVhbUV4Y2VwdGlvbignZGF0YWJpbiBvZiB0eXBlICcgK1xyXG4gICAgICAgICAgICAgICAgZGF0YWJpblR5cGVEZXNjcmlwdGlvbiwgaXNKcGlwVGlsZVBhcnRTdHJlYW0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgZGF0YWJpbiA9IGRhdGFiaW5zQXJyYXkuZGF0YWJpbnNbaW5DbGFzc0lkXTtcclxuICAgICAgICBpZiAoIWRhdGFiaW4pIHtcclxuICAgICAgICAgICAgZGF0YWJpbiA9IGpwaXBGYWN0b3J5LmNyZWF0ZURhdGFiaW5QYXJ0cyhjbGFzc0lkLCBpbkNsYXNzSWQpO1xyXG4gICAgICAgICAgICBkYXRhYmluc0FycmF5LmRhdGFiaW5zW2luQ2xhc3NJZF0gPSBkYXRhYmluO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZGF0YWJpbjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlRGF0YWJpbnNBcnJheSgpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBkYXRhYmluczogW10sXHJcbiAgICAgICAgICAgIGxpc3RlbmVyczogW10sXHJcbiAgICAgICAgICAgIGRhdGFiaW5zV2l0aExpc3RlbmVyczogW11cclxuICAgICAgICAgICAgfTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwT2JqZWN0UG9vbEJ5RGF0YWJpbigpIHtcclxuICAgIHZhciBkYXRhYmluSWRUb09iamVjdCA9IFtdO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE9iamVjdCA9IGZ1bmN0aW9uIGdldE9iamVjdChkYXRhYmluKSB7XHJcbiAgICAgICAgdmFyIGNsYXNzSWQgPSBkYXRhYmluLmdldENsYXNzSWQoKTtcclxuICAgICAgICB2YXIgaW5DbGFzc0lkVG9PYmplY3QgPSBkYXRhYmluSWRUb09iamVjdFtjbGFzc0lkXTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaW5DbGFzc0lkVG9PYmplY3QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBpbkNsYXNzSWRUb09iamVjdCA9IFtdO1xyXG4gICAgICAgICAgICBkYXRhYmluSWRUb09iamVjdFtjbGFzc0lkXSA9IGluQ2xhc3NJZFRvT2JqZWN0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW5DbGFzc0lkID0gZGF0YWJpbi5nZXRJbkNsYXNzSWQoKTtcclxuICAgICAgICB2YXIgb2JqID0gaW5DbGFzc0lkVG9PYmplY3RbaW5DbGFzc0lkXTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAob2JqID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgb2JqID0ge307XHJcbiAgICAgICAgICAgIG9iai5kYXRhYmluID0gZGF0YWJpbjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGluQ2xhc3NJZFRvT2JqZWN0W2luQ2xhc3NJZF0gPSBvYmo7XHJcbiAgICAgICAgfSBlbHNlIGlmIChvYmouZGF0YWJpbiAhPT0gZGF0YWJpbikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdEYXRhYmluIElEcyBhcmUgbm90IHVuaXF1ZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gb2JqO1xyXG4gICAgfTtcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBSZXF1ZXN0RGF0YWJpbnNMaXN0ZW5lcihcclxuICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgcXVhbGl0eUxheWVyUmVhY2hlZENhbGxiYWNrLFxyXG4gICAgY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgIGRhdGFiaW5zU2F2ZXIsXHJcbiAgICBxdWFsaXR5TGF5ZXJzQ2FjaGUsXHJcbiAgICBqcGlwRmFjdG9yeSkge1xyXG4gICAgXHJcbiAgICB2YXIgbnVtUXVhbGl0eUxheWVyc1RvV2FpdEZvcjtcclxuICAgIHZhciB0aWxlSGVhZGVyc05vdExvYWRlZCA9IDA7XHJcbiAgICB2YXIgbWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWQgPSAwO1xyXG4gICAgdmFyIHVucmVnaXN0ZXJlZCA9IGZhbHNlO1xyXG4gICAgXHJcbiAgICB2YXIgcmVnaXN0ZXJlZFRpbGVIZWFkZXJEYXRhYmlucyA9IFtdO1xyXG4gICAgdmFyIHJlZ2lzdGVyZWRQcmVjaW5jdERhdGFiaW5zID0gW107XHJcbiAgICB2YXIgYWNjdW11bGF0ZWREYXRhUGVyRGF0YWJpbiA9IGpwaXBGYWN0b3J5LmNyZWF0ZU9iamVjdFBvb2xCeURhdGFiaW4oKTtcclxuICAgIHZhciBwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyID0gW107XHJcbiAgICBcclxuICAgIHJlZ2lzdGVyKCk7XHJcbiAgICBcclxuICAgIHRoaXMudW5yZWdpc3RlciA9IGZ1bmN0aW9uIHVucmVnaXN0ZXIoKSB7XHJcbiAgICAgICAgaWYgKHVucmVnaXN0ZXJlZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWdpc3RlcmVkVGlsZUhlYWRlckRhdGFiaW5zLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGRhdGFiaW5zU2F2ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihcclxuICAgICAgICAgICAgICAgIHJlZ2lzdGVyZWRUaWxlSGVhZGVyRGF0YWJpbnNbaV0sXHJcbiAgICAgICAgICAgICAgICAnZGF0YUFycml2ZWQnLFxyXG4gICAgICAgICAgICAgICAgdGlsZUhlYWRlckRhdGFBcnJpdmVkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCByZWdpc3RlcmVkUHJlY2luY3REYXRhYmlucy5sZW5ndGg7ICsraikge1xyXG4gICAgICAgICAgICBkYXRhYmluc1NhdmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoXHJcbiAgICAgICAgICAgICAgICByZWdpc3RlcmVkUHJlY2luY3REYXRhYmluc1tqXSxcclxuICAgICAgICAgICAgICAgICdkYXRhQXJyaXZlZCcsXHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdERhdGFBcnJpdmVkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdW5yZWdpc3RlcmVkID0gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyKCkge1xyXG4gICAgICAgICsrdGlsZUhlYWRlcnNOb3RMb2FkZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVJdGVyYXRvciA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0VGlsZXNJdGVyYXRvcihjb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcbiAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICB2YXIgdGlsZUluZGV4ID0gdGlsZUl0ZXJhdG9yLnRpbGVJbmRleDtcclxuICAgICAgICAgICAgdmFyIGRhdGFiaW4gPSBkYXRhYmluc1NhdmVyLmdldFRpbGVIZWFkZXJEYXRhYmluKHRpbGVJbmRleCk7XHJcbiAgICAgICAgICAgIHJlZ2lzdGVyZWRUaWxlSGVhZGVyRGF0YWJpbnMucHVzaChkYXRhYmluKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRhdGFiaW5zU2F2ZXIuYWRkRXZlbnRMaXN0ZW5lcihcclxuICAgICAgICAgICAgICAgIGRhdGFiaW4sICdkYXRhQXJyaXZlZCcsIHRpbGVIZWFkZXJEYXRhQXJyaXZlZCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgKyt0aWxlSGVhZGVyc05vdExvYWRlZDtcclxuICAgICAgICAgICAgdGlsZUhlYWRlckRhdGFBcnJpdmVkKGRhdGFiaW4pO1xyXG4gICAgICAgIH0gd2hpbGUgKHRpbGVJdGVyYXRvci50cnlBZHZhbmNlKCkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC0tdGlsZUhlYWRlcnNOb3RMb2FkZWQ7XHJcbiAgICAgICAgdHJ5QWR2YW5jZVF1YWxpdHlMYXllcnNSZWFjaGVkKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHRpbGVIZWFkZXJEYXRhQXJyaXZlZCh0aWxlSGVhZGVyRGF0YWJpbikge1xyXG4gICAgICAgIGlmICghdGlsZUhlYWRlckRhdGFiaW4uaXNBbGxEYXRhYmluTG9hZGVkKCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgdGlsZUFjY3VtdWxhdGVkRGF0YSA9IGFjY3VtdWxhdGVkRGF0YVBlckRhdGFiaW4uZ2V0T2JqZWN0KFxyXG4gICAgICAgICAgICB0aWxlSGVhZGVyRGF0YWJpbik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRpbGVBY2N1bXVsYXRlZERhdGEuaXNBbHJlYWR5TG9hZGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGlsZUFjY3VtdWxhdGVkRGF0YS5pc0FscmVhZHlMb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgIC0tdGlsZUhlYWRlcnNOb3RMb2FkZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVJbmRleCA9IHRpbGVIZWFkZXJEYXRhYmluLmdldEluQ2xhc3NJZCgpO1xyXG4gICAgICAgIHZhciB0aWxlU3RydWN0dXJlID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRUaWxlU3RydWN0dXJlKHRpbGVJbmRleCk7XHJcbiAgICAgICAgdmFyIHF1YWxpdHlJblRpbGUgPSB0aWxlU3RydWN0dXJlLmdldE51bVF1YWxpdHlMYXllcnMoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcHJlY2luY3RJdGVyYXRvciA9IHRpbGVTdHJ1Y3R1cmUuZ2V0UHJlY2luY3RJdGVyYXRvcihcclxuICAgICAgICAgICAgdGlsZUluZGV4LCBjb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcblxyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgaWYgKCFwcmVjaW5jdEl0ZXJhdG9yLmlzSW5Db2Rlc3RyZWFtUGFydCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgcHJlY2luY3Qgbm90IGluIGNvZGVzdHJlYW0gcGFydCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgaW5DbGFzc0lkID0gdGlsZVN0cnVjdHVyZS5wcmVjaW5jdFBvc2l0aW9uVG9JbkNsYXNzSW5kZXgoXHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdEl0ZXJhdG9yKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgcHJlY2luY3REYXRhYmluID0gZGF0YWJpbnNTYXZlci5nZXRQcmVjaW5jdERhdGFiaW4oaW5DbGFzc0lkKTtcclxuICAgICAgICAgICAgcmVnaXN0ZXJlZFByZWNpbmN0RGF0YWJpbnMucHVzaChwcmVjaW5jdERhdGFiaW4pO1xyXG4gICAgICAgICAgICB2YXIgYWNjdW11bGF0ZWREYXRhID0gYWNjdW11bGF0ZWREYXRhUGVyRGF0YWJpbi5nZXRPYmplY3QoXHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdERhdGFiaW4pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGFjY3VtdWxhdGVkRGF0YS5xdWFsaXR5SW5UaWxlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKCdUaWxlIHdhcyAnICtcclxuICAgICAgICAgICAgICAgICAgICAnaXRlcmF0ZWQgdHdpY2UgaW4gY29kZXN0cmVhbSBwYXJ0Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGFjY3VtdWxhdGVkRGF0YS5xdWFsaXR5SW5UaWxlID0gcXVhbGl0eUluVGlsZTtcclxuICAgICAgICAgICAgaW5jcmVtZW50UHJlY2luY3RRdWFsaXR5TGF5ZXJzKFxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3REYXRhYmluLCBhY2N1bXVsYXRlZERhdGEsIHByZWNpbmN0SXRlcmF0b3IpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGF0YWJpbnNTYXZlci5hZGRFdmVudExpc3RlbmVyKFxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3REYXRhYmluLCAnZGF0YUFycml2ZWQnLCBwcmVjaW5jdERhdGFBcnJpdmVkKTtcclxuICAgICAgICB9IHdoaWxlIChwcmVjaW5jdEl0ZXJhdG9yLnRyeUFkdmFuY2UoKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJ5QWR2YW5jZVF1YWxpdHlMYXllcnNSZWFjaGVkKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHByZWNpbmN0RGF0YUFycml2ZWQocHJlY2luY3REYXRhYmluKSB7XHJcbiAgICAgICAgdmFyIGxvY2FsID0gdW5yZWdpc3RlcmVkO1xyXG4gICAgICAgIHZhciBhY2N1bXVsYXRlZERhdGEgPSBhY2N1bXVsYXRlZERhdGFQZXJEYXRhYmluLmdldE9iamVjdChcclxuICAgICAgICAgICAgcHJlY2luY3REYXRhYmluKTtcclxuXHJcbiAgICAgICAgdmFyIG9sZFF1YWxpdHlMYXllcnNSZWFjaGVkID0gYWNjdW11bGF0ZWREYXRhLm51bVF1YWxpdHlMYXllcnNSZWFjaGVkO1xyXG4gICAgICAgIHZhciBxdWFsaXR5SW5UaWxlID1cclxuICAgICAgICAgICAgYWNjdW11bGF0ZWREYXRhLnF1YWxpdHlJblRpbGU7XHJcblxyXG4gICAgICAgIGlmIChvbGRRdWFsaXR5TGF5ZXJzUmVhY2hlZCA9PT0gcXVhbGl0eUluVGlsZSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC0tcHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllcltvbGRRdWFsaXR5TGF5ZXJzUmVhY2hlZF07XHJcbiAgICAgICAgaW5jcmVtZW50UHJlY2luY3RRdWFsaXR5TGF5ZXJzKHByZWNpbmN0RGF0YWJpbiwgYWNjdW11bGF0ZWREYXRhKTtcclxuICAgICAgICBcclxuICAgICAgICB0cnlBZHZhbmNlUXVhbGl0eUxheWVyc1JlYWNoZWQoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gaW5jcmVtZW50UHJlY2luY3RRdWFsaXR5TGF5ZXJzKFxyXG4gICAgICAgIHByZWNpbmN0RGF0YWJpbiwgYWNjdW11bGF0ZWREYXRhLCBwcmVjaW5jdEl0ZXJhdG9yT3B0aW9uYWwpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcXVhbGl0eUxheWVycyA9IHF1YWxpdHlMYXllcnNDYWNoZS5nZXRRdWFsaXR5TGF5ZXJPZmZzZXQoXHJcbiAgICAgICAgICAgIHByZWNpbmN0RGF0YWJpbixcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMucXVhbGl0eSxcclxuICAgICAgICAgICAgcHJlY2luY3RJdGVyYXRvck9wdGlvbmFsKTtcclxuXHJcbiAgICAgICAgdmFyIG51bVF1YWxpdHlMYXllcnNSZWFjaGVkID0gcXVhbGl0eUxheWVycy5udW1RdWFsaXR5TGF5ZXJzO1xyXG4gICAgICAgIGFjY3VtdWxhdGVkRGF0YS5udW1RdWFsaXR5TGF5ZXJzUmVhY2hlZCA9IG51bVF1YWxpdHlMYXllcnNSZWFjaGVkO1xyXG5cclxuICAgICAgICB2YXIgcXVhbGl0eUluVGlsZSA9XHJcbiAgICAgICAgICAgIGFjY3VtdWxhdGVkRGF0YS5xdWFsaXR5SW5UaWxlO1xyXG5cclxuICAgICAgICBpZiAobnVtUXVhbGl0eUxheWVyc1JlYWNoZWQgPT09IHF1YWxpdHlJblRpbGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgcHJldkNvdW50ID1cclxuICAgICAgICAgICAgcHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllcltudW1RdWFsaXR5TGF5ZXJzUmVhY2hlZF0gfHwgMDtcclxuICAgICAgICBcclxuICAgICAgICBwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyW251bVF1YWxpdHlMYXllcnNSZWFjaGVkXSA9XHJcbiAgICAgICAgICAgIHByZXZDb3VudCArIDE7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHRyeUFkdmFuY2VRdWFsaXR5TGF5ZXJzUmVhY2hlZCgpIHtcclxuICAgICAgICBpZiAocHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllclttaW5OdW1RdWFsaXR5TGF5ZXJzUmVhY2hlZF0gPiAwIHx8XHJcbiAgICAgICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnNSZWFjaGVkID09PSAnbWF4JyB8fFxyXG4gICAgICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzUmVhY2hlZCA+PSBudW1RdWFsaXR5TGF5ZXJzVG9XYWl0Rm9yIHx8XHJcbiAgICAgICAgICAgIHRpbGVIZWFkZXJzTm90TG9hZGVkID4gMCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgaGFzUHJlY2luY3RzSW5RdWFsaXR5TGF5ZXI7XHJcbiAgICAgICAgdmFyIG1heFF1YWxpdHlMYXllcnMgPSBwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyLmxlbmd0aDtcclxuICAgICAgICBcclxuICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgICsrbWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWQ7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAobWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWQgPj0gbWF4UXVhbGl0eUxheWVycykge1xyXG4gICAgICAgICAgICAgICAgbWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWQgPSAnbWF4JztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBoYXNQcmVjaW5jdHNJblF1YWxpdHlMYXllciA9XHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyW21pbk51bVF1YWxpdHlMYXllcnNSZWFjaGVkXSA+IDA7XHJcbiAgICAgICAgfSB3aGlsZSAoIWhhc1ByZWNpbmN0c0luUXVhbGl0eUxheWVyKTtcclxuICAgICAgICBcclxuICAgICAgICBxdWFsaXR5TGF5ZXJSZWFjaGVkQ2FsbGJhY2sobWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBlbnN1cmVRdWFsaXR5TGF5ZXJzU3RhdGlzdGljc0ZvckRlYnVnKCkge1xyXG4gICAgICAgIHZhciBwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyRXhwZWN0ZWQgPSBbXTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlZ2lzdGVyZWRQcmVjaW5jdERhdGFiaW5zLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBhY2N1bXVsYXRlZERhdGEgPSBhY2N1bXVsYXRlZERhdGFQZXJEYXRhYmluLmdldE9iamVjdChcclxuICAgICAgICAgICAgICAgIHJlZ2lzdGVyZWRQcmVjaW5jdERhdGFiaW5zW2ldKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBxdWFsaXR5SW5UaWxlID1cclxuICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkRGF0YS5xdWFsaXR5SW5UaWxlO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChxdWFsaXR5SW5UaWxlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdObyBpbmZvcm1hdGlvbiBvZiBxdWFsaXR5SW5UaWxlIGluICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICdKcGlwUmVxdWVzdERhdGFiaW5zTGlzdGVuZXInKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHF1YWxpdHlMYXllcnMgPSBxdWFsaXR5TGF5ZXJzQ2FjaGUuZ2V0UXVhbGl0eUxheWVyT2Zmc2V0KFxyXG4gICAgICAgICAgICAgICAgcmVnaXN0ZXJlZFByZWNpbmN0RGF0YWJpbnNbaV0sXHJcbiAgICAgICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5xdWFsaXR5KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChxdWFsaXR5TGF5ZXJzLm51bVF1YWxpdHlMYXllcnMgPT09IHF1YWxpdHlJblRpbGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgb2xkVmFsdWUgPSBwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyRXhwZWN0ZWRbXHJcbiAgICAgICAgICAgICAgICBxdWFsaXR5TGF5ZXJzLm51bVF1YWxpdHlMYXllcnNdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllckV4cGVjdGVkW1xyXG4gICAgICAgICAgICAgICAgcXVhbGl0eUxheWVycy5udW1RdWFsaXR5TGF5ZXJzXSA9IChvbGRWYWx1ZSB8fCAwKSArIDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsZW5ndGggPSBNYXRoLm1heChcclxuICAgICAgICAgICAgcHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllckV4cGVjdGVkLmxlbmd0aCxcclxuICAgICAgICAgICAgcHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllci5sZW5ndGgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB2YXIgbWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWRFeHBlY3RlZCA9ICdtYXgnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbGVuZ3RoOyArK2opIHtcclxuICAgICAgICAgICAgdmFyIGlzRXhwZWN0ZWRaZXJvID0gKHByZWNpbmN0Q291bnRCeVJlYWNoZWRRdWFsaXR5TGF5ZXJFeHBlY3RlZFtqXSB8fCAwKSA9PT0gMDtcclxuICAgICAgICAgICAgdmFyIGlzQWN0dWFsWmVybyA9IChwcmVjaW5jdENvdW50QnlSZWFjaGVkUXVhbGl0eUxheWVyW2pdIHx8IDApID09PSAwO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGlzRXhwZWN0ZWRaZXJvICE9PSBpc0FjdHVhbFplcm8pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdXcm9uZyBhY2N1bXVsYXRlZCBzdGF0aXN0aWNzIGluIEpwaXBSZXF1ZXN0RGF0YWJpbnNMaXN0ZW5lcicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoaXNFeHBlY3RlZFplcm8pIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAocHJlY2luY3RDb3VudEJ5UmVhY2hlZFF1YWxpdHlMYXllcltqXSAhPT1cclxuICAgICAgICAgICAgICAgIHByZWNpbmN0Q291bnRCeVJlYWNoZWRRdWFsaXR5TGF5ZXJFeHBlY3RlZFtqXSkge1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbignV3JvbmcgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgJ2FjY3VtdWxhdGVkIHN0YXRpc3RpY3MgaW4gSnBpcFJlcXVlc3REYXRhYmluc0xpc3RlbmVyJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChtaW5OdW1RdWFsaXR5TGF5ZXJzUmVhY2hlZEV4cGVjdGVkID09PSAnbWF4Jykge1xyXG4gICAgICAgICAgICAgICAgbWluTnVtUXVhbGl0eUxheWVyc1JlYWNoZWRFeHBlY3RlZCA9IGo7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1pbk51bVF1YWxpdHlMYXllcnNSZWFjaGVkICE9PSBtaW5OdW1RdWFsaXR5TGF5ZXJzUmVhY2hlZEV4cGVjdGVkKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1dyb25nIG1pbk51bVF1YWxpdHlMYXllcnNSZWFjaGVkIGluIEpwaXBSZXF1ZXN0RGF0YWJpbnNMaXN0ZW5lcicpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBDb2Rlc3RyZWFtU3RydWN0dXJlKFxyXG4gICAganBpcFN0cnVjdHVyZVBhcnNlcixcclxuICAgIGpwaXBGYWN0b3J5LFxyXG4gICAgcHJvZ3Jlc3Npb25PcmRlcikge1xyXG5cclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHZhciBwYXJhbXM7XHJcbiAgICB2YXIgc2l6ZXNDYWxjdWxhdG9yO1xyXG4gICAgXHJcbiAgICB2YXIgZGVmYXVsdFRpbGVTdHJ1Y3R1cmVCeUVkZ2VUeXBlO1xyXG5cclxuICAgIHZhciBjYWNoZWRUaWxlU3RydWN0dXJlcyA9IFtdO1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFNpemVzUGFyYW1zID0gZnVuY3Rpb24gZ2V0U2l6ZXNQYXJhbXMoKSB7XHJcbiAgICAgICAgdmFsaWRhdGVQYXJhbXMoKTtcclxuICAgICAgICByZXR1cm4gcGFyYW1zO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXROdW1UaWxlc1ggPSBmdW5jdGlvbiBnZXROdW1UaWxlc1goKSB7XHJcbiAgICAgICAgdmFsaWRhdGVQYXJhbXMoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtVGlsZXMgPSBzaXplc0NhbGN1bGF0b3IuZ2V0TnVtVGlsZXNYKCk7XHJcbiAgICAgICAgcmV0dXJuIG51bVRpbGVzO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXROdW1UaWxlc1kgPSBmdW5jdGlvbiBnZXROdW1UaWxlc1koKSB7XHJcbiAgICAgICAgdmFsaWRhdGVQYXJhbXMoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtVGlsZXMgPSBzaXplc0NhbGN1bGF0b3IuZ2V0TnVtVGlsZXNZKCk7XHJcbiAgICAgICAgcmV0dXJuIG51bVRpbGVzO1xyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLmdldE51bUNvbXBvbmVudHMgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG4gICAgICAgIHJldHVybiBwYXJhbXMubnVtQ29tcG9uZW50cztcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0SW1hZ2VXaWR0aCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcblxyXG4gICAgICAgIHZhciBzaXplID0gc2l6ZXNDYWxjdWxhdG9yLmdldExldmVsV2lkdGgoKTtcclxuICAgICAgICByZXR1cm4gc2l6ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0SW1hZ2VIZWlnaHQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG5cclxuICAgICAgICB2YXIgc2l6ZSA9IHNpemVzQ2FsY3VsYXRvci5nZXRMZXZlbEhlaWdodCgpO1xyXG4gICAgICAgIHJldHVybiBzaXplO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRMZXZlbFdpZHRoID0gZnVuY3Rpb24obGV2ZWwpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG5cclxuICAgICAgICB2YXIgc2l6ZSA9IHNpemVzQ2FsY3VsYXRvci5nZXRMZXZlbFdpZHRoKGxldmVsKTtcclxuICAgICAgICByZXR1cm4gc2l6ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TGV2ZWxIZWlnaHQgPSBmdW5jdGlvbihsZXZlbCkge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcblxyXG4gICAgICAgIHZhciBzaXplID0gc2l6ZXNDYWxjdWxhdG9yLmdldExldmVsSGVpZ2h0KGxldmVsKTtcclxuICAgICAgICByZXR1cm4gc2l6ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VGlsZVdpZHRoID0gZnVuY3Rpb24obGV2ZWwpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG5cclxuICAgICAgICB2YXIgc2l6ZSA9IHNpemVzQ2FsY3VsYXRvci5nZXRUaWxlV2lkdGgobGV2ZWwpO1xyXG4gICAgICAgIHJldHVybiBzaXplO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRUaWxlSGVpZ2h0ID0gZnVuY3Rpb24obGV2ZWwpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG5cclxuICAgICAgICB2YXIgc2l6ZSA9IHNpemVzQ2FsY3VsYXRvci5nZXRUaWxlSGVpZ2h0KGxldmVsKTtcclxuICAgICAgICByZXR1cm4gc2l6ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Rmlyc3RUaWxlT2Zmc2V0WCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcblxyXG4gICAgICAgIHZhciBvZmZzZXQgPSBzaXplc0NhbGN1bGF0b3IuZ2V0Rmlyc3RUaWxlT2Zmc2V0WCgpO1xyXG4gICAgICAgIHJldHVybiBvZmZzZXQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEZpcnN0VGlsZU9mZnNldFkgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG5cclxuICAgICAgICB2YXIgb2Zmc2V0ID0gc2l6ZXNDYWxjdWxhdG9yLmdldEZpcnN0VGlsZU9mZnNldFkoKTtcclxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRUaWxlTGVmdCA9IGZ1bmN0aW9uIGdldFRpbGVMZWZ0KFxyXG4gICAgICAgIHRpbGVJbmRleCwgbGV2ZWwpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlWCA9IHRpbGVJbmRleCAlIHNpemVzQ2FsY3VsYXRvci5nZXROdW1UaWxlc1goKTtcclxuICAgICAgICBpZiAodGlsZVggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlTGVmdCA9XHJcbiAgICAgICAgICAgICh0aWxlWCAtIDEpICogc2l6ZXNDYWxjdWxhdG9yLmdldFRpbGVXaWR0aChsZXZlbCkgK1xyXG4gICAgICAgICAgICBzaXplc0NhbGN1bGF0b3IuZ2V0Rmlyc3RUaWxlV2lkdGgobGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aWxlTGVmdDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VGlsZVRvcCA9IGZ1bmN0aW9uIGdldFRpbGVUb3AodGlsZUluZGV4LCBsZXZlbCkge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVZID0gTWF0aC5mbG9vcih0aWxlSW5kZXggLyBzaXplc0NhbGN1bGF0b3IuZ2V0TnVtVGlsZXNYKCkpO1xyXG4gICAgICAgIGlmICh0aWxlWSA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVUb3AgPVxyXG4gICAgICAgICAgICAodGlsZVkgLSAxKSAqIHNpemVzQ2FsY3VsYXRvci5nZXRUaWxlSGVpZ2h0KGxldmVsKSArXHJcbiAgICAgICAgICAgIHNpemVzQ2FsY3VsYXRvci5nZXRGaXJzdFRpbGVIZWlnaHQobGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aWxlVG9wO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXREZWZhdWx0VGlsZVN0cnVjdHVyZSA9IGZ1bmN0aW9uIGdldERlZmF1bHRUaWxlU3RydWN0dXJlKCkge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IGdldERlZmF1bHRUaWxlU3RydWN0dXJlSW50ZXJuYWwoe1xyXG4gICAgICAgICAgICBob3Jpem9udGFsRWRnZVR5cGU6IHNpemVzQ2FsY3VsYXRvci5FREdFX1RZUEVfTk9fRURHRSxcclxuICAgICAgICAgICAgdmVydGljYWxFZGdlVHlwZTogc2l6ZXNDYWxjdWxhdG9yLkVER0VfVFlQRV9OT19FREdFXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRUaWxlU3RydWN0dXJlID0gZ2V0VGlsZVN0cnVjdHVyZTtcclxuXHJcbiAgICB0aGlzLnRpbGVQb3NpdGlvblRvSW5DbGFzc0luZGV4ID0gZnVuY3Rpb24odGlsZVBvc2l0aW9uKSB7XHJcbiAgICAgICAgdmFsaWRhdGVQYXJhbXMoKTtcclxuICAgICAgICB2YXIgdGlsZXNYID0gc2l6ZXNDYWxjdWxhdG9yLmdldE51bVRpbGVzWCgpO1xyXG4gICAgICAgIHZhciB0aWxlc1kgPSBzaXplc0NhbGN1bGF0b3IuZ2V0TnVtVGlsZXNZKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFsaWRhdGVBcmd1bWVudEluUmFuZ2UoJ3RpbGVQb3NpdGlvbi50aWxlWCcsIHRpbGVQb3NpdGlvbi50aWxlWCwgdGlsZXNYKTtcclxuICAgICAgICB2YWxpZGF0ZUFyZ3VtZW50SW5SYW5nZSgndGlsZVBvc2l0aW9uLnRpbGVZJywgdGlsZVBvc2l0aW9uLnRpbGVZLCB0aWxlc1kpO1xyXG5cclxuICAgICAgICB2YXIgaW5DbGFzc0luZGV4ID0gdGlsZVBvc2l0aW9uLnRpbGVYICsgdGlsZVBvc2l0aW9uLnRpbGVZICogdGlsZXNYO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBpbkNsYXNzSW5kZXg7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMudGlsZUluQ2xhc3NJbmRleFRvUG9zaXRpb24gPSBmdW5jdGlvbihpbkNsYXNzSW5kZXgpIHtcclxuICAgICAgICB2YWxpZGF0ZVBhcmFtcygpO1xyXG4gICAgICAgIHZhciB0aWxlc1ggPSBzaXplc0NhbGN1bGF0b3IuZ2V0TnVtVGlsZXNYKCk7XHJcbiAgICAgICAgdmFyIHRpbGVzWSA9IHNpemVzQ2FsY3VsYXRvci5nZXROdW1UaWxlc1koKTtcclxuICAgICAgICB2YXIgbnVtVGlsZXMgPSB0aWxlc1ggKiB0aWxlc1k7XHJcblxyXG4gICAgICAgIHZhbGlkYXRlQXJndW1lbnRJblJhbmdlKCdpbkNsYXNzSW5kZXgnLCBpbkNsYXNzSW5kZXgsIHRpbGVzWCAqIHRpbGVzWSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVYID0gaW5DbGFzc0luZGV4ICUgdGlsZXNYO1xyXG4gICAgICAgIHZhciB0aWxlWSA9IChpbkNsYXNzSW5kZXggLSB0aWxlWCkgLyB0aWxlc1g7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgdGlsZVg6IHRpbGVYLFxyXG4gICAgICAgICAgICB0aWxlWTogdGlsZVlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRUaWxlc0l0ZXJhdG9yID0gZnVuY3Rpb24gZ2V0VGlsZXNJdGVyYXRvcihjb2Rlc3RyZWFtUGFydFBhcmFtcykge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcbiAgICAgICAgdmFyIGJvdW5kcyA9IHNpemVzQ2FsY3VsYXRvci5nZXRUaWxlc0Zyb21QaXhlbHMoY29kZXN0cmVhbVBhcnRQYXJhbXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzZXRhYmxlSXRlcmF0b3IgPSB7XHJcbiAgICAgICAgICAgIGN1cnJlbnRYOiBib3VuZHMubWluVGlsZVgsXHJcbiAgICAgICAgICAgIGN1cnJlbnRZOiBib3VuZHMubWluVGlsZVlcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpdGVyYXRvciA9IHtcclxuICAgICAgICAgICAgZ2V0IHRpbGVJbmRleCgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBmaXJzdEluUm93ID1cclxuICAgICAgICAgICAgICAgICAgICBzZXRhYmxlSXRlcmF0b3IuY3VycmVudFkgKiBzaXplc0NhbGN1bGF0b3IuZ2V0TnVtVGlsZXNYKCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBmaXJzdEluUm93ICsgc2V0YWJsZUl0ZXJhdG9yLmN1cnJlbnRYO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0cnlBZHZhbmNlOiBmdW5jdGlvbiB0cnlBZHZhbmNlKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHRyeUFkdmFuY2VUaWxlSXRlcmF0b3Ioc2V0YWJsZUl0ZXJhdG9yLCBib3VuZHMpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGl0ZXJhdG9yO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRTaXplT2ZQYXJ0ID0gZnVuY3Rpb24gZ2V0U2l6ZU9mUGFydChjb2Rlc3RyZWFtUGFydFBhcmFtcykge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNpemUgPSBzaXplc0NhbGN1bGF0b3IuZ2V0U2l6ZU9mUGFydChjb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcbiAgICAgICAgcmV0dXJuIHNpemU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiB0cnlBZHZhbmNlVGlsZUl0ZXJhdG9yKHNldGFibGVJdGVyYXRvciwgYm91bmRzKSB7XHJcbiAgICAgICAgaWYgKHNldGFibGVJdGVyYXRvci5jdXJyZW50WSA+PSBib3VuZHMubWF4VGlsZVlFeGNsdXNpdmUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnQ2Fubm90IGFkdmFuY2UgdGlsZSBpdGVyYXRvciBhZnRlciBlbmQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgKytzZXRhYmxlSXRlcmF0b3IuY3VycmVudFg7XHJcbiAgICAgICAgaWYgKHNldGFibGVJdGVyYXRvci5jdXJyZW50WCA8IGJvdW5kcy5tYXhUaWxlWEV4Y2x1c2l2ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2V0YWJsZUl0ZXJhdG9yLmN1cnJlbnRYID0gYm91bmRzLm1pblRpbGVYO1xyXG4gICAgICAgICsrc2V0YWJsZUl0ZXJhdG9yLmN1cnJlbnRZO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpc01vcmVUaWxlc0F2YWlsYWJsZSA9XHJcbiAgICAgICAgICAgIHNldGFibGVJdGVyYXRvci5jdXJyZW50WSA8IGJvdW5kcy5tYXhUaWxlWUV4Y2x1c2l2ZTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gaXNNb3JlVGlsZXNBdmFpbGFibGU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldFRpbGVTdHJ1Y3R1cmUodGlsZUlkKSB7XHJcbiAgICAgICAgdmFsaWRhdGVQYXJhbXMoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbWF4VGlsZUlkID1cclxuICAgICAgICAgICAgc2l6ZXNDYWxjdWxhdG9yLmdldE51bVRpbGVzWCgpICogc2l6ZXNDYWxjdWxhdG9yLmdldE51bVRpbGVzWSgpLSAxO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aWxlSWQgPCAwIHx8IHRpbGVJZCA+IG1heFRpbGVJZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuQXJndW1lbnRFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAndGlsZUlkJyxcclxuICAgICAgICAgICAgICAgIHRpbGVJZCxcclxuICAgICAgICAgICAgICAgICdFeHBlY3RlZCB2YWx1ZSBiZXR3ZWVuIDAgYW5kICcgKyBtYXhUaWxlSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgaXNFZGdlID0gc2l6ZXNDYWxjdWxhdG9yLmlzRWRnZVRpbGVJZCh0aWxlSWQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjYWNoZWRUaWxlU3RydWN0dXJlc1t0aWxlSWRdID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdmFyIHRpbGVQYXJhbXMgPSBqcGlwU3RydWN0dXJlUGFyc2VyLnBhcnNlT3ZlcnJpZGVuVGlsZVBhcmFtcyh0aWxlSWQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCEhdGlsZVBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgY2FjaGVkVGlsZVN0cnVjdHVyZXNbdGlsZUlkXSA9IGNyZWF0ZVRpbGVTdHJ1Y3R1cmUodGlsZVBhcmFtcywgaXNFZGdlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNhY2hlZFRpbGVTdHJ1Y3R1cmVzW3RpbGVJZF0gPSBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjYWNoZWRUaWxlU3RydWN0dXJlc1t0aWxlSWRdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRUaWxlU3RydWN0dXJlc1t0aWxlSWRdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0gZ2V0RGVmYXVsdFRpbGVTdHJ1Y3R1cmVJbnRlcm5hbChpc0VkZ2UpO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVBcmd1bWVudEluUmFuZ2UocGFyYW1OYW1lLCBwYXJhbVZhbHVlLCBzdXByaW11bVBhcmFtVmFsdWUpIHtcclxuICAgICAgICBpZiAocGFyYW1WYWx1ZSA8IDAgfHwgcGFyYW1WYWx1ZSA+PSBzdXByaW11bVBhcmFtVmFsdWUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkFyZ3VtZW50RXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lLFxyXG4gICAgICAgICAgICAgICAgcGFyYW1WYWx1ZSxcclxuICAgICAgICAgICAgICAgIHBhcmFtTmFtZSArICcgaXMgZXhwZWN0ZWQgdG8gYmUgYmV0d2VlbiAwIGFuZCAnICsgc3VwcmltdW1QYXJhbVZhbHVlIC0gMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXREZWZhdWx0VGlsZVN0cnVjdHVyZUludGVybmFsKGVkZ2VUeXBlKSB7XHJcbiAgICAgICAgaWYgKCFkZWZhdWx0VGlsZVN0cnVjdHVyZUJ5RWRnZVR5cGUpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmF1bHRUaWxlUGFyYW1zID0ganBpcFN0cnVjdHVyZVBhcnNlci5wYXJzZURlZmF1bHRUaWxlUGFyYW1zKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkZWZhdWx0VGlsZVN0cnVjdHVyZUJ5RWRnZVR5cGUgPSBuZXcgQXJyYXkoMyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciBob3Jpem9udGFsRWRnZSA9IDA7IGhvcml6b250YWxFZGdlIDwgMzsgKytob3Jpem9udGFsRWRnZSkge1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdFRpbGVTdHJ1Y3R1cmVCeUVkZ2VUeXBlW2hvcml6b250YWxFZGdlXSA9IG5ldyBBcnJheSgzKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgdmVydGljYWxFZGdlID0gMDsgdmVydGljYWxFZGdlIDwgMzsgKyt2ZXJ0aWNhbEVkZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZWRnZSA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaG9yaXpvbnRhbEVkZ2VUeXBlOiBob3Jpem9udGFsRWRnZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVydGljYWxFZGdlVHlwZTogdmVydGljYWxFZGdlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdFRpbGVTdHJ1Y3R1cmVCeUVkZ2VUeXBlW2hvcml6b250YWxFZGdlXVt2ZXJ0aWNhbEVkZ2VdID1cclxuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlVGlsZVN0cnVjdHVyZShkZWZhdWx0VGlsZVBhcmFtcywgZWRnZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN0cnVjdHVyZUJ5VmVydGljYWxUeXBlID1cclxuICAgICAgICAgICAgZGVmYXVsdFRpbGVTdHJ1Y3R1cmVCeUVkZ2VUeXBlW2VkZ2VUeXBlLmhvcml6b250YWxFZGdlVHlwZV07XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVTdHJ1Y3R1cmUgPSBzdHJ1Y3R1cmVCeVZlcnRpY2FsVHlwZVtlZGdlVHlwZS52ZXJ0aWNhbEVkZ2VUeXBlXTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGlsZVN0cnVjdHVyZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlVGlsZVN0cnVjdHVyZSh0aWxlUGFyYW1zLCBlZGdlVHlwZSkge1xyXG4gICAgICAgIHZhbGlkYXRlUGFyYW1zKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNpemVQYXJhbXMgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRpbGVQYXJhbXMpKTtcclxuICAgICAgICBcclxuICAgICAgICBzaXplUGFyYW1zLnRpbGVTaXplID0gc2l6ZXNDYWxjdWxhdG9yLmdldFRpbGVTaXplKGVkZ2VUeXBlKTtcclxuICAgICAgICBcclxuICAgICAgICBzaXplUGFyYW1zLmRlZmF1bHRDb21wb25lbnRQYXJhbXMuc2NhbGVYID0gMTtcclxuICAgICAgICBzaXplUGFyYW1zLmRlZmF1bHRDb21wb25lbnRQYXJhbXMuc2NhbGVZID0gMTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNpemVQYXJhbXMucGFyYW1zUGVyQ29tcG9uZW50Lmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHNpemVQYXJhbXMucGFyYW1zUGVyQ29tcG9uZW50W2ldLnNjYWxlWCA9IHBhcmFtcy5jb21wb25lbnRzU2NhbGVYW2ldO1xyXG4gICAgICAgICAgICBzaXplUGFyYW1zLnBhcmFtc1BlckNvbXBvbmVudFtpXS5zY2FsZVkgPSBwYXJhbXMuY29tcG9uZW50c1NjYWxlWVtpXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVTdHJ1Y3R1cmUgPSBqcGlwRmFjdG9yeS5jcmVhdGVUaWxlU3RydWN0dXJlKHNpemVQYXJhbXMsIHNlbGYsIHByb2dyZXNzaW9uT3JkZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aWxlU3RydWN0dXJlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiB2YWxpZGF0ZVBhcmFtcyhzZWxmKSB7XHJcbiAgICAgICAgaWYgKCFwYXJhbXMpIHtcclxuICAgICAgICAgICAgcGFyYW1zID0ganBpcFN0cnVjdHVyZVBhcnNlci5wYXJzZUNvZGVzdHJlYW1TdHJ1Y3R1cmUoKTtcclxuICAgICAgICAgICAgc2l6ZXNDYWxjdWxhdG9yID0ganBpcEZhY3RvcnkuY3JlYXRlTGV2ZWxDYWxjdWxhdG9yKHBhcmFtcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcztcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBDb21wb25lbnRTdHJ1Y3R1cmUoXHJcbiAgICBwYXJhbXMsIHRpbGVTdHJ1Y3R1cmUpIHtcclxuICAgIFxyXG4gICAgdmFyIHRpbGVXaWR0aExldmVsMDtcclxuICAgIHZhciB0aWxlSGVpZ2h0TGV2ZWwwO1xyXG4gICAgXHJcbiAgICBpbml0aWFsaXplKCk7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Q29tcG9uZW50U2NhbGVYID0gZnVuY3Rpb24gZ2V0Q29tcG9uZW50U2NhbGVYKCkge1xyXG4gICAgICAgIHJldHVybiBwYXJhbXMuc2NhbGVYO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRDb21wb25lbnRTY2FsZVkgPSBmdW5jdGlvbiBnZXRDb21wb25lbnRTY2FsZVkoKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhcmFtcy5zY2FsZVk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE51bVJlc29sdXRpb25MZXZlbHMgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gcGFyYW1zLm51bVJlc29sdXRpb25MZXZlbHM7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFByZWNpbmN0V2lkdGggPSBmdW5jdGlvbihyZXNvbHV0aW9uTGV2ZWwpIHtcclxuICAgICAgICB2YXIgd2lkdGggPSBwYXJhbXMucHJlY2luY3RXaWR0aFBlckxldmVsW3Jlc29sdXRpb25MZXZlbF07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHdpZHRoO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRQcmVjaW5jdEhlaWdodCA9IGZ1bmN0aW9uKHJlc29sdXRpb25MZXZlbCkge1xyXG4gICAgICAgIHZhciBoZWlnaHQgPSBwYXJhbXMucHJlY2luY3RIZWlnaHRQZXJMZXZlbFtyZXNvbHV0aW9uTGV2ZWxdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBoZWlnaHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE1heENvZGVibG9ja1dpZHRoID0gZnVuY3Rpb24gZ2V0TWF4Q29kZWJsb2NrV2lkdGgoKSB7XHJcbiAgICAgICAgdmFyIHdpZHRoID0gcGFyYW1zLm1heENvZGVibG9ja1dpZHRoO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB3aWR0aDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TWF4Q29kZWJsb2NrSGVpZ2h0ID0gZnVuY3Rpb24gZ2V0TWF4Q29kZWJsb2NrSGVpZ2h0KCkge1xyXG4gICAgICAgIHZhciBoZWlnaHQgPSBwYXJhbXMubWF4Q29kZWJsb2NrSGVpZ2h0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBoZWlnaHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE51bUNvZGVibG9ja3NYSW5QcmVjaW5jdCA9XHJcbiAgICAgICAgZnVuY3Rpb24gZ2V0TnVtQ29kZWJsb2Nrc1gocHJlY2luY3QpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtQ29kZWJsb2Nrc1ggPSBjYWxjdWxhdGVOdW1Db2RlYmxvY2tzKFxyXG4gICAgICAgICAgICBwcmVjaW5jdCxcclxuICAgICAgICAgICAgcHJlY2luY3QucHJlY2luY3RYLFxyXG4gICAgICAgICAgICBwYXJhbXMubWF4Q29kZWJsb2NrV2lkdGgsXHJcbiAgICAgICAgICAgIHBhcmFtcy5wcmVjaW5jdFdpZHRoUGVyTGV2ZWwsXHJcbiAgICAgICAgICAgIHRpbGVXaWR0aExldmVsMCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG51bUNvZGVibG9ja3NYO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXROdW1Db2RlYmxvY2tzWUluUHJlY2luY3QgPVxyXG4gICAgICAgIGZ1bmN0aW9uIGdldE51bUNvZGVibG9ja3NZKHByZWNpbmN0KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG51bUNvZGVibG9ja3NZID0gY2FsY3VsYXRlTnVtQ29kZWJsb2NrcyhcclxuICAgICAgICAgICAgcHJlY2luY3QsXHJcbiAgICAgICAgICAgIHByZWNpbmN0LnByZWNpbmN0WSxcclxuICAgICAgICAgICAgcGFyYW1zLm1heENvZGVibG9ja0hlaWdodCxcclxuICAgICAgICAgICAgcGFyYW1zLnByZWNpbmN0SGVpZ2h0UGVyTGV2ZWwsXHJcbiAgICAgICAgICAgIHRpbGVIZWlnaHRMZXZlbDApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBudW1Db2RlYmxvY2tzWTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5nZXROdW1QcmVjaW5jdHNYID0gZnVuY3Rpb24ocmVzb2x1dGlvbkxldmVsKSB7XHJcbiAgICAgICAgdmFyIHByZWNpbmN0c1ggPSBjYWxjdWxhdGVOdW1QcmVjaW5jdHMoXHJcbiAgICAgICAgICAgIHRpbGVXaWR0aExldmVsMCwgcGFyYW1zLnByZWNpbmN0V2lkdGhQZXJMZXZlbCwgcmVzb2x1dGlvbkxldmVsKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHByZWNpbmN0c1g7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE51bVByZWNpbmN0c1kgPSBmdW5jdGlvbihyZXNvbHV0aW9uTGV2ZWwpIHtcclxuICAgICAgICB2YXIgcHJlY2luY3RzWSA9IGNhbGN1bGF0ZU51bVByZWNpbmN0cyhcclxuICAgICAgICAgICAgdGlsZUhlaWdodExldmVsMCwgcGFyYW1zLnByZWNpbmN0SGVpZ2h0UGVyTGV2ZWwsIHJlc29sdXRpb25MZXZlbCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHJldHVybiBwcmVjaW5jdHNZO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlTnVtUHJlY2luY3RzKFxyXG4gICAgICAgIHRpbGVTaXplTGV2ZWwwLCBwcmVjaW5jdFNpemVQZXJMZXZlbCwgcmVzb2x1dGlvbkxldmVsKSB7XHJcbiAgICBcclxuICAgICAgICB2YXIgcmVzb2x1dGlvbkZhY3RvciA9IGdldFJlc29sdXRpb25GYWN0b3IocmVzb2x1dGlvbkxldmVsKTtcclxuICAgICAgICB2YXIgdGlsZVNpemVJbkxldmVsID0gdGlsZVNpemVMZXZlbDAgLyByZXNvbHV0aW9uRmFjdG9yO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwcmVjaW5jdFNpemVJbkxldmVsID0gcHJlY2luY3RTaXplUGVyTGV2ZWxbcmVzb2x1dGlvbkxldmVsXTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtUHJlY2luY3RzID0gTWF0aC5jZWlsKHRpbGVTaXplSW5MZXZlbCAvIHByZWNpbmN0U2l6ZUluTGV2ZWwpO1xyXG4gICAgICAgIHJldHVybiBudW1QcmVjaW5jdHM7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZU51bUNvZGVibG9ja3MoXHJcbiAgICAgICAgcHJlY2luY3QsXHJcbiAgICAgICAgcHJlY2luY3RJbmRleCxcclxuICAgICAgICBtYXhDb2RlYmxvY2tTaXplLFxyXG4gICAgICAgIHByZWNpbmN0U2l6ZVBlckxldmVsLFxyXG4gICAgICAgIHRpbGVTaXplTGV2ZWwwKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc29sdXRpb25GYWN0b3IgPSBnZXRSZXNvbHV0aW9uRmFjdG9yKHByZWNpbmN0LnJlc29sdXRpb25MZXZlbCk7XHJcbiAgICAgICAgdmFyIHRpbGVTaXplSW5MZXZlbCA9IE1hdGguY2VpbCh0aWxlU2l6ZUxldmVsMCAvIHJlc29sdXRpb25GYWN0b3IpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwcmVjaW5jdEJlZ2luUGl4ZWwgPVxyXG4gICAgICAgICAgICBwcmVjaW5jdEluZGV4ICogcHJlY2luY3RTaXplUGVyTGV2ZWxbcHJlY2luY3QucmVzb2x1dGlvbkxldmVsXTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcHJlY2luY3RTaXplID0gTWF0aC5taW4oXHJcbiAgICAgICAgICAgIHByZWNpbmN0U2l6ZVBlckxldmVsW3ByZWNpbmN0LnJlc29sdXRpb25MZXZlbF0sXHJcbiAgICAgICAgICAgIHRpbGVTaXplSW5MZXZlbCAtIHByZWNpbmN0QmVnaW5QaXhlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN1YmJhbmRUeXBlRmFjdG9yID0gcHJlY2luY3QucmVzb2x1dGlvbkxldmVsID09PSAwID8gMSA6IDI7XHJcbiAgICAgICAgdmFyIHN1YmJhbmRPZlByZWNpbmN0U2l6ZSA9IE1hdGguY2VpbChwcmVjaW5jdFNpemUgLyBzdWJiYW5kVHlwZUZhY3Rvcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG51bUNvZGVibG9ja3MgPSBzdWJiYW5kVHlwZUZhY3RvciAqIE1hdGguY2VpbChcclxuICAgICAgICAgICAgc3ViYmFuZE9mUHJlY2luY3RTaXplIC8gbWF4Q29kZWJsb2NrU2l6ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHByZWNpbmN0U2l6ZSAlIG1heENvZGVibG9ja1NpemUgPT09IDEgJiZcclxuICAgICAgICAgICAgcHJlY2luY3QucmVzb2x1dGlvbkxldmVsID4gMCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLS1udW1Db2RlYmxvY2tzO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbnVtQ29kZWJsb2NrcztcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0UmVzb2x1dGlvbkZhY3RvcihyZXNvbHV0aW9uTGV2ZWwpIHtcclxuICAgICAgICB2YXIgZGlmZmVyZW5jZUZyb21CZXN0TGV2ZWwgPSBwYXJhbXMubnVtUmVzb2x1dGlvbkxldmVscyAtIHJlc29sdXRpb25MZXZlbCAtIDE7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZhY3RvciA9IDEgPDwgZGlmZmVyZW5jZUZyb21CZXN0TGV2ZWw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZhY3RvcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcclxuICAgICAgICBpZiAocGFyYW1zLnNjYWxlWCAhPT0gMSB8fCBwYXJhbXMuc2NhbGVZICE9PSAxKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qMmtFeGNlcHRpb25zLlVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdOb24gMSBjb21wb25lbnQgc2NhbGUnLCAnQS41LjEnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGlsZVdpZHRoTGV2ZWwwID0gTWF0aC5mbG9vcihcclxuICAgICAgICAgICAgdGlsZVN0cnVjdHVyZS5nZXRUaWxlV2lkdGgoKSAvIHBhcmFtcy5zY2FsZVgpO1xyXG4gICAgICAgIHRpbGVIZWlnaHRMZXZlbDAgPSBNYXRoLmZsb29yKFxyXG4gICAgICAgICAgICB0aWxlU3RydWN0dXJlLmdldFRpbGVIZWlnaHQoKSAvIHBhcmFtcy5zY2FsZVkpO1xyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSnBpcFJlcXVlc3RQYXJhbXNNb2RpZmllcjtcclxuXHJcbmZ1bmN0aW9uIEpwaXBSZXF1ZXN0UGFyYW1zTW9kaWZpZXIoY29kZXN0cmVhbVN0cnVjdHVyZSkge1xyXG4gICAgdGhpcy5tb2RpZnkgPSBmdW5jdGlvbiBtb2RpZnkoY29kZXN0cmVhbVBhcnRQYXJhbXMsIG9wdGlvbnMpIHtcclxuICAgICAgICB2YXIgY29kZXN0cmVhbVBhcnRQYXJhbXNNb2RpZmllZCA9IGNhc3RDb2Rlc3RyZWFtUGFydFBhcmFtcyhjb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcblxyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG4gICAgICAgIHZhciB1c2VDYWNoZWREYXRhT25seSA9IG9wdGlvbnMudXNlQ2FjaGVkRGF0YU9ubHk7XHJcbiAgICAgICAgdmFyIGRpc2FibGVQcm9ncmVzc2l2ZW5lc3MgPSBvcHRpb25zLmRpc2FibGVQcm9ncmVzc2l2ZW5lc3M7XHJcblxyXG4gICAgICAgIHZhciBwcm9ncmVzc2l2ZW5lc3NNb2RpZmllZDtcclxuICAgICAgICBpZiAob3B0aW9ucy5wcm9ncmVzc2l2ZW5lc3MgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBpZiAodXNlQ2FjaGVkRGF0YU9ubHkgfHwgZGlzYWJsZVByb2dyZXNzaXZlbmVzcykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkFyZ3VtZW50RXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdvcHRpb25zLnByb2dyZXNzaXZlbmVzcycsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5wcm9ncmVzc2l2ZW5lc3MsXHJcbiAgICAgICAgICAgICAgICAgICAgJ29wdGlvbnMgY29udHJhZGljdGlvbjogY2Fubm90IGFjY2VwdCBib3RoIHByb2dyZXNzaXZlbmVzcycgK1xyXG4gICAgICAgICAgICAgICAgICAgICdhbmQgdXNlQ2FjaGVkRGF0YU9ubHkvZGlzYWJsZVByb2dyZXNzaXZlbmVzcyBvcHRpb25zJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcHJvZ3Jlc3NpdmVuZXNzTW9kaWZpZWQgPSBjYXN0UHJvZ3Jlc3NpdmVuZXNzUGFyYW1zKFxyXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wcm9ncmVzc2l2ZW5lc3MsXHJcbiAgICAgICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtc01vZGlmaWVkLnF1YWxpdHksXHJcbiAgICAgICAgICAgICAgICAncXVhbGl0eScpO1xyXG4gICAgICAgIH0gZWxzZSAgaWYgKHVzZUNhY2hlZERhdGFPbmx5KSB7XHJcbiAgICAgICAgICAgIHByb2dyZXNzaXZlbmVzc01vZGlmaWVkID0gWyB7IG1pbk51bVF1YWxpdHlMYXllcnM6IDAgfSBdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZGlzYWJsZVByb2dyZXNzaXZlbmVzcykge1xyXG4gICAgICAgICAgICB2YXIgcXVhbGl0eSA9IGNvZGVzdHJlYW1QYXJ0UGFyYW1zTW9kaWZpZWQucXVhbGl0eTtcclxuICAgICAgICAgICAgdmFyIG1pbk51bVF1YWxpdHlMYXllcnMgPVxyXG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9PT0gdW5kZWZpbmVkID8gJ21heCcgOiBxdWFsaXR5O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcHJvZ3Jlc3NpdmVuZXNzTW9kaWZpZWQgPSBbIHsgbWluTnVtUXVhbGl0eUxheWVyczogbWluTnVtUXVhbGl0eUxheWVycyB9IF07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NpdmVuZXNzTW9kaWZpZWQgPSBnZXRBdXRvbWF0aWNQcm9ncmVzc2l2ZW5lc3NTdGFnZXMoXHJcbiAgICAgICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtc01vZGlmaWVkLnF1YWxpdHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtczogY29kZXN0cmVhbVBhcnRQYXJhbXNNb2RpZmllZCxcclxuICAgICAgICAgICAgcHJvZ3Jlc3NpdmVuZXNzOiBwcm9ncmVzc2l2ZW5lc3NNb2RpZmllZFxyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIGNhc3RQcm9ncmVzc2l2ZW5lc3NQYXJhbXMocHJvZ3Jlc3NpdmVuZXNzLCBxdWFsaXR5LCBwcm9wZXJ0eU5hbWUpIHtcclxuICAgICAgICAvLyBFbnN1cmUgdGhhbiBtaW5OdW1RdWFsaXR5TGF5ZXJzIGlzIGdpdmVuIGZvciBhbGwgaXRlbXNcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KHByb2dyZXNzaXZlbmVzcy5sZW5ndGgpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb2dyZXNzaXZlbmVzcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgbWluTnVtUXVhbGl0eUxheWVycyA9IHByb2dyZXNzaXZlbmVzc1tpXS5taW5OdW1RdWFsaXR5TGF5ZXJzO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG1pbk51bVF1YWxpdHlMYXllcnMgIT09ICdtYXgnKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocXVhbGl0eSAhPT0gdW5kZWZpbmVkICYmXHJcbiAgICAgICAgICAgICAgICAgICAgbWluTnVtUXVhbGl0eUxheWVycyA+IHF1YWxpdHkpIHtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuQXJndW1lbnRFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdwcm9ncmVzc2l2ZW5lc3NbJyArIGkgKyAnXS5taW5OdW1RdWFsaXR5TGF5ZXJzJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWluTnVtUXVhbGl0eUxheWVycyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ21pbk51bVF1YWxpdHlMYXllcnMgaXMgYmlnZ2VyIHRoYW4gJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZmV0Y2hQYXJhbXMucXVhbGl0eScpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzID0gdmFsaWRhdGVOdW1lcmljUGFyYW0oXHJcbiAgICAgICAgICAgICAgICAgICAgbWluTnVtUXVhbGl0eUxheWVycyxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3Byb2dyZXNzaXZlbmVzc1snICsgaSArICddLm1pbk51bVF1YWxpdHlMYXllcnMnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmVzdWx0W2ldID0geyBtaW5OdW1RdWFsaXR5TGF5ZXJzOiBtaW5OdW1RdWFsaXR5TGF5ZXJzIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0QXV0b21hdGljUHJvZ3Jlc3NpdmVuZXNzU3RhZ2VzKHF1YWxpdHkpIHtcclxuICAgICAgICAvLyBDcmVhdGUgcHJvZ3Jlc3NpdmVuZXNzIG9mICgxLCAyLCAzLCAoI21heC1xdWFsaXR5LzIpLCAoI21heC1xdWFsaXR5KSlcclxuXHJcbiAgICAgICAgdmFyIHByb2dyZXNzaXZlbmVzcyA9IFtdO1xyXG5cclxuICAgICAgICAvLyBObyBwcm9ncmVzc2l2ZW5lc3MsIHdhaXQgZm9yIGFsbCBxdWFsaXR5IGxheWVycyB0byBiZSBmZXRjaGVkXHJcbiAgICAgICAgdmFyIHRpbGVTdHJ1Y3R1cmUgPSBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldERlZmF1bHRUaWxlU3RydWN0dXJlKCk7XHJcbiAgICAgICAgdmFyIG51bVF1YWxpdHlMYXllcnNOdW1lcmljID0gdGlsZVN0cnVjdHVyZS5nZXROdW1RdWFsaXR5TGF5ZXJzKCk7XHJcbiAgICAgICAgdmFyIHF1YWxpdHlOdW1lcmljT3JNYXggPSAnbWF4JztcclxuICAgICAgICBcclxuICAgICAgICBpZiAocXVhbGl0eSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIG51bVF1YWxpdHlMYXllcnNOdW1lcmljID0gTWF0aC5taW4oXHJcbiAgICAgICAgICAgICAgICBudW1RdWFsaXR5TGF5ZXJzTnVtZXJpYywgcXVhbGl0eSk7XHJcbiAgICAgICAgICAgIHF1YWxpdHlOdW1lcmljT3JNYXggPSBudW1RdWFsaXR5TGF5ZXJzTnVtZXJpYztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZpcnN0UXVhbGl0eUxheWVyc0NvdW50ID0gbnVtUXVhbGl0eUxheWVyc051bWVyaWMgPCA0ID9cclxuICAgICAgICAgICAgbnVtUXVhbGl0eUxheWVyc051bWVyaWMgLSAxOiAzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgZmlyc3RRdWFsaXR5TGF5ZXJzQ291bnQ7ICsraSkge1xyXG4gICAgICAgICAgICBwcm9ncmVzc2l2ZW5lc3MucHVzaCh7IG1pbk51bVF1YWxpdHlMYXllcnM6IGkgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBtaWRkbGVRdWFsaXR5ID0gTWF0aC5yb3VuZChudW1RdWFsaXR5TGF5ZXJzTnVtZXJpYyAvIDIpO1xyXG4gICAgICAgIGlmIChtaWRkbGVRdWFsaXR5ID4gZmlyc3RRdWFsaXR5TGF5ZXJzQ291bnQpIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NpdmVuZXNzLnB1c2goeyBtaW5OdW1RdWFsaXR5TGF5ZXJzOiBtaWRkbGVRdWFsaXR5IH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBwcm9ncmVzc2l2ZW5lc3MucHVzaCh7XHJcbiAgICAgICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnM6IHF1YWxpdHlOdW1lcmljT3JNYXhcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHByb2dyZXNzaXZlbmVzcztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjYXN0Q29kZXN0cmVhbVBhcnRQYXJhbXMoY29kZXN0cmVhbVBhcnRQYXJhbXMpIHtcclxuICAgICAgICB2YXIgbGV2ZWwgPSB2YWxpZGF0ZU51bWVyaWNQYXJhbShcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMubGV2ZWwsXHJcbiAgICAgICAgICAgICdsZXZlbCcsXHJcbiAgICAgICAgICAgIC8qZGVmYXVsdFZhbHVlPSovdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAvKmFsbG93VW5kZWZpZW5kPSovdHJ1ZSk7XHJcblxyXG4gICAgICAgIHZhciBxdWFsaXR5ID0gdmFsaWRhdGVOdW1lcmljUGFyYW0oXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLnF1YWxpdHksXHJcbiAgICAgICAgICAgICdxdWFsaXR5JyxcclxuICAgICAgICAgICAgLypkZWZhdWx0VmFsdWU9Ki91bmRlZmluZWQsXHJcbiAgICAgICAgICAgIC8qYWxsb3dVbmRlZmllbmQ9Ki90cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbWluWCA9IHZhbGlkYXRlTnVtZXJpY1BhcmFtKGNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1pblgsICdtaW5YJyk7XHJcbiAgICAgICAgdmFyIG1pblkgPSB2YWxpZGF0ZU51bWVyaWNQYXJhbShjb2Rlc3RyZWFtUGFydFBhcmFtcy5taW5ZLCAnbWluWScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBtYXhYID0gdmFsaWRhdGVOdW1lcmljUGFyYW0oXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1heFhFeGNsdXNpdmUsICdtYXhYRXhjbHVzaXZlJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1heFkgPSB2YWxpZGF0ZU51bWVyaWNQYXJhbShcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMubWF4WUV4Y2x1c2l2ZSwgJ21heFlFeGNsdXNpdmUnKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbGV2ZWxXaWR0aCA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TGV2ZWxXaWR0aChsZXZlbCk7XHJcbiAgICAgICAgdmFyIGxldmVsSGVpZ2h0ID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRMZXZlbEhlaWdodChsZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1pblggPCAwIHx8IG1heFggPiBsZXZlbFdpZHRoIHx8XHJcbiAgICAgICAgICAgIG1pblkgPCAwIHx8IG1heFkgPiBsZXZlbEhlaWdodCB8fFxyXG4gICAgICAgICAgICBtaW5YID49IG1heFggfHwgbWluWSA+PSBtYXhZKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuQXJndW1lbnRFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnY29kZXN0cmVhbVBhcnRQYXJhbXMnLCBjb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgIG1pblg6IG1pblgsXHJcbiAgICAgICAgICAgIG1pblk6IG1pblksXHJcbiAgICAgICAgICAgIG1heFhFeGNsdXNpdmU6IG1heFgsXHJcbiAgICAgICAgICAgIG1heFlFeGNsdXNpdmU6IG1heFksXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsZXZlbDogbGV2ZWwsXHJcbiAgICAgICAgICAgIHF1YWxpdHk6IHF1YWxpdHlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlTnVtZXJpY1BhcmFtKFxyXG4gICAgICAgIGlucHV0VmFsdWUsIHByb3BlcnR5TmFtZSwgZGVmYXVsdFZhbHVlLCBhbGxvd1VuZGVmaW5lZCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpbnB1dFZhbHVlID09PSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgKGRlZmF1bHRWYWx1ZSAhPT0gdW5kZWZpbmVkIHx8IGFsbG93VW5kZWZpbmVkKSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9ICtpbnB1dFZhbHVlO1xyXG4gICAgICAgIGlmIChpc05hTihyZXN1bHQpIHx8IHJlc3VsdCAhPT0gTWF0aC5mbG9vcihyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5Bcmd1bWVudEV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgIHByb3BlcnR5TmFtZSwgaW5wdXRWYWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbn0iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5KcGlwVGlsZVN0cnVjdHVyZSA9IGZ1bmN0aW9uIEpwaXBUaWxlU3RydWN0dXJlKFxyXG4gICAgc2l6ZVBhcmFtcyxcclxuICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICBqcGlwRmFjdG9yeSxcclxuICAgIHByb2dyZXNzaW9uT3JkZXJcclxuICAgICkge1xyXG4gICAgXHJcbiAgICB2YXIgZGVmYXVsdENvbXBvbmVudFN0cnVjdHVyZTtcclxuICAgIHZhciBjb21wb25lbnRTdHJ1Y3R1cmVzO1xyXG4gICAgdmFyIGNvbXBvbmVudFRvSW5DbGFzc0xldmVsU3RhcnRJbmRleDtcclxuICAgIHZhciBtaW5OdW1SZXNvbHV0aW9uTGV2ZWxzO1xyXG5cclxuICAgIHRoaXMuZ2V0UHJvZ3Jlc3Npb25PcmRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBwcm9ncmVzc2lvbk9yZGVyO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXREZWZhdWx0Q29tcG9uZW50U3RydWN0dXJlID0gZnVuY3Rpb24gZ2V0RGVmYXVsdENvbXBvbmVudFN0cnVjdHVyZShjb21wb25lbnQpIHtcclxuICAgICAgICByZXR1cm4gZGVmYXVsdENvbXBvbmVudFN0cnVjdHVyZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Q29tcG9uZW50U3RydWN0dXJlID0gZnVuY3Rpb24gZ2V0Q29tcG9uZW50U3RydWN0dXJlKGNvbXBvbmVudCkge1xyXG4gICAgICAgIHJldHVybiBjb21wb25lbnRTdHJ1Y3R1cmVzW2NvbXBvbmVudF07XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFRpbGVXaWR0aCA9IGZ1bmN0aW9uIGdldFRpbGVXaWR0aENsb3N1cmUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHNpemVQYXJhbXMudGlsZVNpemVbMF07XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFRpbGVIZWlnaHQgPSBmdW5jdGlvbiBnZXRUaWxlSGVpZ2h0Q2xvc3VyZSgpIHtcclxuICAgICAgICByZXR1cm4gc2l6ZVBhcmFtcy50aWxlU2l6ZVsxXTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TnVtUXVhbGl0eUxheWVycyA9IGZ1bmN0aW9uIGdldE51bVF1YWxpdHlMYXllcnMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHNpemVQYXJhbXMubnVtUXVhbGl0eUxheWVycztcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0SXNQYWNrZXRIZWFkZXJOZWFyRGF0YSA9IGZ1bmN0aW9uIGdldElzUGFja2V0SGVhZGVyTmVhckRhdGEoKSB7XHJcbiAgICAgICAgcmV0dXJuIHNpemVQYXJhbXMuaXNQYWNrZXRIZWFkZXJzTmVhckRhdGE7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldElzU3RhcnRPZlBhY2tldE1hcmtlckFsbG93ZWQgPSBmdW5jdGlvbiBnZXRJc1N0YXJ0T2ZQYWNrZXRNYXJrZXJBbGxvd2VkKCkge1xyXG4gICAgICAgIHJldHVybiBzaXplUGFyYW1zLmlzU3RhcnRPZlBhY2tldE1hcmtlckFsbG93ZWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldElzRW5kUGFja2V0SGVhZGVyTWFya2VyQWxsb3dlZCA9XHJcbiAgICAgICAgZnVuY3Rpb24gZ2V0SXNFbmRQYWNrZXRIZWFkZXJNYXJrZXJBbGxvd2VkKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBzaXplUGFyYW1zLmlzRW5kUGFja2V0SGVhZGVyTWFya2VyQWxsb3dlZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMucHJlY2luY3RJbkNsYXNzSW5kZXhUb1Bvc2l0aW9uID0gZnVuY3Rpb24oaW5DbGFzc0luZGV4KSB7XHJcbiAgICAgICAgLy8gQS4zLjJcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaW5DbGFzc0luZGV4IDwgMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuQXJndW1lbnRFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnaW5DbGFzc0luZGV4JyxcclxuICAgICAgICAgICAgICAgIGluQ2xhc3NJbmRleCxcclxuICAgICAgICAgICAgICAgICdJbnZhbGlkIG5lZ2F0aXZlIGluLWNsYXNzIGluZGV4IG9mIHByZWNpbmN0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBudW1UaWxlcyA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TnVtVGlsZXNYKCkgKiBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldE51bVRpbGVzWSgpO1xyXG4gICAgICAgIHZhciBudW1Db21wb25lbnRzID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1Db21wb25lbnRzKCk7XHJcblxyXG4gICAgICAgIHZhciB0aWxlSW5kZXggPSBpbkNsYXNzSW5kZXggJSBudW1UaWxlcztcclxuICAgICAgICB2YXIgaW5DbGFzc0luZGV4V2l0aG91dFRpbGUgPSAoaW5DbGFzc0luZGV4IC0gdGlsZUluZGV4KSAvIG51bVRpbGVzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjb21wb25lbnQgPSBpbkNsYXNzSW5kZXhXaXRob3V0VGlsZSAlIG51bUNvbXBvbmVudHM7XHJcbiAgICAgICAgdmFyIGNvbXBvbmVudFN0cnVjdHVyZSA9IGNvbXBvbmVudFN0cnVjdHVyZXNbY29tcG9uZW50XTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtUmVzb2x1dGlvbkxldmVscyA9IGNvbXBvbmVudFN0cnVjdHVyZS5nZXROdW1SZXNvbHV0aW9uTGV2ZWxzKCk7XHJcbiAgICAgICAgdmFyIHByZWNpbmN0SW5kZXggPSAoaW5DbGFzc0luZGV4V2l0aG91dFRpbGUgLSBjb21wb25lbnQpIC8gbnVtQ29tcG9uZW50cztcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzb2x1dGlvbkxldmVsO1xyXG4gICAgICAgIHZhciBsZXZlbFN0YXJ0SW5kZXggPSAwO1xyXG4gICAgICAgIGZvciAocmVzb2x1dGlvbkxldmVsID0gMTsgcmVzb2x1dGlvbkxldmVsIDwgbnVtUmVzb2x1dGlvbkxldmVsczsgKytyZXNvbHV0aW9uTGV2ZWwpIHtcclxuICAgICAgICAgICAgdmFyIG5leHRMZXZlbFN0YXJ0SW5kZXggPVxyXG4gICAgICAgICAgICAgICAgY29tcG9uZW50VG9JbkNsYXNzTGV2ZWxTdGFydEluZGV4W2NvbXBvbmVudF1bcmVzb2x1dGlvbkxldmVsXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChuZXh0TGV2ZWxTdGFydEluZGV4ID4gcHJlY2luY3RJbmRleCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxldmVsU3RhcnRJbmRleCA9IG5leHRMZXZlbFN0YXJ0SW5kZXg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC0tcmVzb2x1dGlvbkxldmVsO1xyXG4gICAgICAgIHZhciBwcmVjaW5jdEluZGV4SW5MZXZlbCA9IHByZWNpbmN0SW5kZXggLSBsZXZlbFN0YXJ0SW5kZXg7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHByZWNpbmN0c1ggPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUHJlY2luY3RzWChyZXNvbHV0aW9uTGV2ZWwpO1xyXG4gICAgICAgIHZhciBwcmVjaW5jdHNZID0gY29tcG9uZW50U3RydWN0dXJlLmdldE51bVByZWNpbmN0c1kocmVzb2x1dGlvbkxldmVsKTtcclxuXHJcbiAgICAgICAgdmFyIHByZWNpbmN0WCA9IHByZWNpbmN0SW5kZXhJbkxldmVsICUgcHJlY2luY3RzWDtcclxuICAgICAgICB2YXIgcHJlY2luY3RZID0gKHByZWNpbmN0SW5kZXhJbkxldmVsIC0gcHJlY2luY3RYKSAvIHByZWNpbmN0c1g7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHByZWNpbmN0WSA+PSBwcmVjaW5jdHNZKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5Bcmd1bWVudEV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdpbkNsYXNzSW5kZXgnLFxyXG4gICAgICAgICAgICAgICAgaW5DbGFzc0luZGV4LFxyXG4gICAgICAgICAgICAgICAgJ0ludmFsaWQgaW4tY2xhc3MgaW5kZXggb2YgcHJlY2luY3QnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgdGlsZUluZGV4OiB0aWxlSW5kZXgsXHJcbiAgICAgICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50LFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcHJlY2luY3RYOiBwcmVjaW5jdFgsXHJcbiAgICAgICAgICAgIHByZWNpbmN0WTogcHJlY2luY3RZLFxyXG4gICAgICAgICAgICByZXNvbHV0aW9uTGV2ZWw6IHJlc29sdXRpb25MZXZlbFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnByZWNpbmN0UG9zaXRpb25Ub0luQ2xhc3NJbmRleCA9IGZ1bmN0aW9uKHByZWNpbmN0UG9zaXRpb24pIHtcclxuICAgICAgICAvLyBBLjMuMlxyXG5cclxuICAgICAgICB2YXIgbnVtQ29tcG9uZW50cyA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TnVtQ29tcG9uZW50cygpO1xyXG4gICAgICAgIHZhbGlkYXRlQXJndW1lbnRJblJhbmdlKFxyXG4gICAgICAgICAgICAncHJlY2luY3RQb3NpdGlvbi5jb21wb25lbnQnLCBwcmVjaW5jdFBvc2l0aW9uLmNvbXBvbmVudCwgbnVtQ29tcG9uZW50cyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvbXBvbmVudFN0cnVjdHVyZSA9IGNvbXBvbmVudFN0cnVjdHVyZXNbcHJlY2luY3RQb3NpdGlvbi5jb21wb25lbnRdO1xyXG5cclxuICAgICAgICB2YXIgbnVtUmVzb2x1dGlvbkxldmVscyA9IGNvbXBvbmVudFN0cnVjdHVyZS5nZXROdW1SZXNvbHV0aW9uTGV2ZWxzKCk7XHJcbiAgICAgICAgdmFsaWRhdGVBcmd1bWVudEluUmFuZ2UoXHJcbiAgICAgICAgICAgICdwcmVjaW5jdFBvc2l0aW9uLnJlc29sdXRpb25MZXZlbCcsIHByZWNpbmN0UG9zaXRpb24ucmVzb2x1dGlvbkxldmVsLCBudW1SZXNvbHV0aW9uTGV2ZWxzKTtcclxuXHJcbiAgICAgICAgdmFyIG51bVRpbGVzID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1UaWxlc1goKSAqIGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TnVtVGlsZXNZKCk7XHJcbiAgICAgICAgdmFyIHByZWNpbmN0c1ggPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUHJlY2luY3RzWChwcmVjaW5jdFBvc2l0aW9uLnJlc29sdXRpb25MZXZlbCk7XHJcbiAgICAgICAgdmFyIHByZWNpbmN0c1kgPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUHJlY2luY3RzWShwcmVjaW5jdFBvc2l0aW9uLnJlc29sdXRpb25MZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFsaWRhdGVBcmd1bWVudEluUmFuZ2UoXHJcbiAgICAgICAgICAgICdwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WCcsIHByZWNpbmN0UG9zaXRpb24ucHJlY2luY3RYLCBwcmVjaW5jdHNYKTtcclxuICAgICAgICB2YWxpZGF0ZUFyZ3VtZW50SW5SYW5nZShcclxuICAgICAgICAgICAgJ3ByZWNpbmN0UG9zaXRpb24ucHJlY2luY3RZJywgcHJlY2luY3RQb3NpdGlvbi5wcmVjaW5jdFksIHByZWNpbmN0c1kpO1xyXG4gICAgICAgIHZhbGlkYXRlQXJndW1lbnRJblJhbmdlKFxyXG4gICAgICAgICAgICAncHJlY2luY3RQb3NpdGlvbi50aWxlSW5kZXgnLCBwcmVjaW5jdFBvc2l0aW9uLnRpbGVJbmRleCwgbnVtVGlsZXMpO1xyXG5cclxuICAgICAgICB2YXIgcHJlY2luY3RJbmRleEluTGV2ZWwgPSBwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WCArIFxyXG4gICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WSAqIHByZWNpbmN0c1g7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxldmVsU3RhcnRJbmRleCA9IGNvbXBvbmVudFRvSW5DbGFzc0xldmVsU3RhcnRJbmRleFtwcmVjaW5jdFBvc2l0aW9uLmNvbXBvbmVudF1bcHJlY2luY3RQb3NpdGlvbi5yZXNvbHV0aW9uTGV2ZWxdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwcmVjaW5jdEluZGV4ID0gcHJlY2luY3RJbmRleEluTGV2ZWwgKyBsZXZlbFN0YXJ0SW5kZXg7XHJcblxyXG4gICAgICAgIHZhciBpbkNsYXNzSW5kZXhXaXRob3V0VGlsZSA9XHJcbiAgICAgICAgICAgIHByZWNpbmN0UG9zaXRpb24uY29tcG9uZW50ICsgcHJlY2luY3RJbmRleCAqIGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TnVtQ29tcG9uZW50cygpO1xyXG5cclxuICAgICAgICB2YXIgaW5DbGFzc0luZGV4ID0gcHJlY2luY3RQb3NpdGlvbi50aWxlSW5kZXggKyBcclxuICAgICAgICAgICAgaW5DbGFzc0luZGV4V2l0aG91dFRpbGUgKiBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldE51bVRpbGVzWCgpICogY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1UaWxlc1koKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gaW5DbGFzc0luZGV4O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRQcmVjaW5jdEl0ZXJhdG9yID0gZnVuY3Rpb24gZ2V0UHJlY2luY3RJdGVyYXRvcihcclxuICAgICAgICB0aWxlSW5kZXgsIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLCBpc0l0ZXJhdGVQcmVjaW5jdHNOb3RJbkNvZGVzdHJlYW1QYXJ0KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxldmVsID0gMDtcclxuICAgICAgICBpZiAoY29kZXN0cmVhbVBhcnRQYXJhbXMgIT09IHVuZGVmaW5lZCAmJlxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5sZXZlbCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsZXZlbCA9IGNvZGVzdHJlYW1QYXJ0UGFyYW1zLmxldmVsO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG1pbk51bVJlc29sdXRpb25MZXZlbHMgPD0gbGV2ZWwpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdDYW5ub3QgYWR2YW5jZSByZXNvbHV0aW9uOiBsZXZlbD0nICtcclxuICAgICAgICAgICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5sZXZlbCArICcgYnV0IHNob3VsZCAnICtcclxuICAgICAgICAgICAgICAgICAgICAnYmUgc21hbGxlciB0aGFuICcgKyBtaW5OdW1SZXNvbHV0aW9uTGV2ZWxzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHByZWNpbmN0c0luQ29kZXN0cmVhbVBhcnRQZXJMZXZlbFBlckNvbXBvbmVudCA9XHJcbiAgICAgICAgICAgIGdldFByZWNpbmN0c0luQ29kZXN0cmVhbVBhcnRQZXJMZXZlbFBlckNvbXBvbmVudChcclxuICAgICAgICAgICAgICAgIHRpbGVJbmRleCwgY29kZXN0cmVhbVBhcnRQYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgdmFyIHByZWNpbmN0WCA9IDA7XHJcbiAgICAgICAgdmFyIHByZWNpbmN0WSA9IDA7XHJcbiAgICAgICAgaWYgKCFpc0l0ZXJhdGVQcmVjaW5jdHNOb3RJbkNvZGVzdHJlYW1QYXJ0ICYmXHJcbiAgICAgICAgICAgIHByZWNpbmN0c0luQ29kZXN0cmVhbVBhcnRQZXJMZXZlbFBlckNvbXBvbmVudCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGZpcnN0UHJlY2luY3RzUmFuZ2UgPVxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RzSW5Db2Rlc3RyZWFtUGFydFBlckxldmVsUGVyQ29tcG9uZW50WzBdWzBdO1xyXG4gICAgICAgICAgICBwcmVjaW5jdFggPSBmaXJzdFByZWNpbmN0c1JhbmdlLm1pblByZWNpbmN0WDtcclxuICAgICAgICAgICAgcHJlY2luY3RZID0gZmlyc3RQcmVjaW5jdHNSYW5nZS5taW5QcmVjaW5jdFk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEEuNi4xIGluIHBhcnQgMTogQ29yZSBDb2RpbmcgU3lzdGVtXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNldGFibGVJdGVyYXRvciA9IHtcclxuICAgICAgICAgICAgY29tcG9uZW50OiAwLFxyXG4gICAgICAgICAgICBwcmVjaW5jdFg6IHByZWNpbmN0WCxcclxuICAgICAgICAgICAgcHJlY2luY3RZOiBwcmVjaW5jdFksXHJcbiAgICAgICAgICAgIHJlc29sdXRpb25MZXZlbDogMCxcclxuICAgICAgICAgICAgaXNJbkNvZGVzdHJlYW1QYXJ0OiB0cnVlXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBpdGVyYXRvciA9IHtcclxuICAgICAgICAgICAgZ2V0IHRpbGVJbmRleCgpIHsgcmV0dXJuIHRpbGVJbmRleDsgfSxcclxuICAgICAgICAgICAgZ2V0IGNvbXBvbmVudCgpIHsgcmV0dXJuIHNldGFibGVJdGVyYXRvci5jb21wb25lbnQ7IH0sXHJcbiAgICAgICAgICAgIGdldCBwcmVjaW5jdEluZGV4SW5Db21wb25lbnRSZXNvbHV0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNvbXBvbmVudFN0cnVjdHVyZSA9IGNvbXBvbmVudFN0cnVjdHVyZXNbc2V0YWJsZUl0ZXJhdG9yLmNvbXBvbmVudF07XHJcbiAgICAgICAgICAgICAgICB2YXIgcHJlY2luY3RzWCA9IGNvbXBvbmVudFN0cnVjdHVyZS5nZXROdW1QcmVjaW5jdHNYKFxyXG4gICAgICAgICAgICAgICAgICAgIHNldGFibGVJdGVyYXRvci5yZXNvbHV0aW9uTGV2ZWwpO1xyXG4gICAgICAgICAgICAgICAgc2V0YWJsZUl0ZXJhdG9yLnByZWNpbmN0SW5kZXhJbkNvbXBvbmVudFJlc29sdXRpb24gPVxyXG4gICAgICAgICAgICAgICAgICAgIHNldGFibGVJdGVyYXRvci5wcmVjaW5jdFggKyBzZXRhYmxlSXRlcmF0b3IucHJlY2luY3RZICogcHJlY2luY3RzWDtcclxuICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXRhYmxlSXRlcmF0b3IucHJlY2luY3RJbmRleEluQ29tcG9uZW50UmVzb2x1dGlvbjtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBnZXQgcHJlY2luY3RYKCkgeyByZXR1cm4gc2V0YWJsZUl0ZXJhdG9yLnByZWNpbmN0WDsgfSxcclxuICAgICAgICAgICAgZ2V0IHByZWNpbmN0WSgpIHsgcmV0dXJuIHNldGFibGVJdGVyYXRvci5wcmVjaW5jdFk7IH0sXHJcbiAgICAgICAgICAgIGdldCByZXNvbHV0aW9uTGV2ZWwoKSB7IHJldHVybiBzZXRhYmxlSXRlcmF0b3IucmVzb2x1dGlvbkxldmVsOyB9LFxyXG4gICAgICAgICAgICBnZXQgaXNJbkNvZGVzdHJlYW1QYXJ0KCkgeyByZXR1cm4gc2V0YWJsZUl0ZXJhdG9yLmlzSW5Db2Rlc3RyZWFtUGFydDsgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGl0ZXJhdG9yLnRyeUFkdmFuY2UgPSBmdW5jdGlvbiB0cnlBZHZhbmNlKCkge1xyXG4gICAgICAgICAgICB2YXIgaXNTdWNjZWVkZWQgPSB0cnlBZHZhbmNlUHJlY2luY3RJdGVyYXRvcihcclxuICAgICAgICAgICAgICAgIHNldGFibGVJdGVyYXRvcixcclxuICAgICAgICAgICAgICAgIGxldmVsLFxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RzSW5Db2Rlc3RyZWFtUGFydFBlckxldmVsUGVyQ29tcG9uZW50LFxyXG4gICAgICAgICAgICAgICAgaXNJdGVyYXRlUHJlY2luY3RzTm90SW5Db2Rlc3RyZWFtUGFydCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gaXNTdWNjZWVkZWQ7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gaXRlcmF0b3I7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiB2YWxpZGF0ZUFyZ3VtZW50SW5SYW5nZShwYXJhbU5hbWUsIHBhcmFtVmFsdWUsIHN1cHJpbXVtUGFyYW1WYWx1ZSkge1xyXG4gICAgICAgIGlmIChwYXJhbVZhbHVlIDwgMCB8fCBwYXJhbVZhbHVlID49IHN1cHJpbXVtUGFyYW1WYWx1ZSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuQXJndW1lbnRFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICBwYXJhbU5hbWUsXHJcbiAgICAgICAgICAgICAgICBwYXJhbVZhbHVlLFxyXG4gICAgICAgICAgICAgICAgcGFyYW1OYW1lICsgJyBpcyBleHBlY3RlZCB0byBiZSBiZXR3ZWVuIDAgYW5kICcgKyBzdXByaW11bVBhcmFtVmFsdWUgLSAxKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlVGFyZ2V0UHJvZ3Jlc3Npb25PcmRlcihwcm9ncmVzc2lvbk9yZGVyKSB7XHJcbiAgICAgICAgaWYgKHByb2dyZXNzaW9uT3JkZXIubGVuZ3RoICE9PSA0KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qMmtFeGNlcHRpb25zLklsbGVnYWxEYXRhRXhjZXB0aW9uKCdJbGxlZ2FsIHByb2dyZXNzaW9uIG9yZGVyICcgKyBwcm9ncmVzc2lvbk9yZGVyICsgJzogdW5leHBlY3RlZCBsZW5ndGgnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHByb2dyZXNzaW9uT3JkZXJbM10gIT09ICdMJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oJ0lsbGVnYWwgdGFyZ2V0IHByb2dyZXNzaW9uIG9yZGVyIG9mICcgKyBwcm9ncmVzc2lvbk9yZGVyLCAnQS4zLjIuMScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgaGFzUCA9IHByb2dyZXNzaW9uT3JkZXIuaW5kZXhPZignUCcpID49IDA7XHJcbiAgICAgICAgdmFyIGhhc0MgPSBwcm9ncmVzc2lvbk9yZGVyLmluZGV4T2YoJ0MnKSA+PSAwO1xyXG4gICAgICAgIHZhciBoYXNSID0gcHJvZ3Jlc3Npb25PcmRlci5pbmRleE9mKCdSJykgPj0gMDtcclxuICAgICAgICBpZiAoIWhhc1AgfHwgIWhhc0MgfHwgIWhhc1IpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oJ0lsbGVnYWwgcHJvZ3Jlc3Npb24gb3JkZXIgJyArIHByb2dyZXNzaW9uT3JkZXIgKyAnOiBtaXNzaW5nIGxldHRlcicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAocHJvZ3Jlc3Npb25PcmRlciAhPT0gJ1JQQ0wnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qMmtFeGNlcHRpb25zLlVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbignUHJvZ3Jlc3Npb24gb3JkZXIgb2YgJyArIHByb2dyZXNzaW9uT3JkZXIsICdBLjYuMScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcHJlcHJvY2Vzc1BhcmFtcygpIHtcclxuICAgICAgICBjb21wb25lbnRUb0luQ2xhc3NMZXZlbFN0YXJ0SW5kZXggPSBuZXcgQXJyYXkoY29tcG9uZW50cyk7XHJcblxyXG4gICAgICAgIHZhciBjb21wb25lbnRzID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1Db21wb25lbnRzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGRlZmF1bHRDb21wb25lbnQgPSBzaXplUGFyYW1zLmRlZmF1bHRDb21wb25lbnRQYXJhbXM7XHJcbiAgICAgICAgbWluTnVtUmVzb2x1dGlvbkxldmVscyA9IGRlZmF1bHRDb21wb25lbnQubnVtUmVzb2x1dGlvbkxldmVscztcclxuICAgICAgICB2YXIgaXNDb21wb25lbnRzSWRlbnRpY2FsU2l6ZSA9IHRydWU7XHJcbiAgICAgICAgdmFyIGlzUHJlY2luY3RQYXJ0aXRpb25GaXRzVG9UaWxlUGFydGl0aW9uID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgYyA9IDA7IGMgPCBjb21wb25lbnRzOyArK2MpIHtcclxuICAgICAgICAgICAgdmFyIHNpemUgPSBzaXplUGFyYW1zLnBhcmFtc1BlckNvbXBvbmVudFtjXTtcclxuICAgICAgICAgICAgbWluTnVtUmVzb2x1dGlvbkxldmVscyA9IE1hdGgubWluKFxyXG4gICAgICAgICAgICAgICAgbWluTnVtUmVzb2x1dGlvbkxldmVscywgc2l6ZS5udW1SZXNvbHV0aW9uTGV2ZWxzKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb21wb25lbnRUb0luQ2xhc3NMZXZlbFN0YXJ0SW5kZXhbY10gPSBuZXcgQXJyYXkoc2l6ZS5udW1SZXNvbHV0aW9uTGV2ZWxzKTtcclxuICAgICAgICAgICAgdmFyIGNvbXBvbmVudFN0cnVjdHVyZSA9IGNvbXBvbmVudFN0cnVjdHVyZXNbY107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYWNjdW11bGF0ZWRPZmZzZXQgPSAwO1xyXG4gICAgICAgICAgICB2YXIgZmlyc3RMZXZlbFByZWNpbmN0c1ggPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUHJlY2luY3RzWChjKTtcclxuICAgICAgICAgICAgdmFyIGZpcnN0TGV2ZWxQcmVjaW5jdHNZID0gY29tcG9uZW50U3RydWN0dXJlLmdldE51bVByZWNpbmN0c1koYyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHNpemUubnVtUmVzb2x1dGlvbkxldmVsczsgKytyKSB7XHJcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUb0luQ2xhc3NMZXZlbFN0YXJ0SW5kZXhbY11bcl0gPSBhY2N1bXVsYXRlZE9mZnNldDtcclxuICAgICAgICAgICAgICAgIHZhciBwcmVjaW5jdHNYSW5MZXZlbCA9IGNvbXBvbmVudFN0cnVjdHVyZS5nZXROdW1QcmVjaW5jdHNYKHIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHByZWNpbmN0c1lJbkxldmVsID0gY29tcG9uZW50U3RydWN0dXJlLmdldE51bVByZWNpbmN0c1kocik7XHJcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZE9mZnNldCArPSBwcmVjaW5jdHNYSW5MZXZlbCAqIHByZWNpbmN0c1lJbkxldmVsO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0Q29tcG9uZW50LnByZWNpbmN0V2lkdGhQZXJMZXZlbFtyXSAhPT1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZS5wcmVjaW5jdFdpZHRoUGVyTGV2ZWxbcl0gfHxcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0Q29tcG9uZW50LnByZWNpbmN0SGVpZ2h0UGVyTGV2ZWxbcl0gIT09XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemUucHJlY2luY3RIZWlnaHRQZXJMZXZlbFtyXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlzQ29tcG9uZW50c0lkZW50aWNhbFNpemUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGlzSG9yaXpvbnRhbFBhcnRpdGlvblN1cHBvcnRlZCA9XHJcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tJZlByZWNpbmN0UGFydGl0aW9uU3RhcnRzSW5UaWxlVG9wTGVmdChcclxuICAgICAgICAgICAgICAgICAgICAgICAgcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZS5udW1SZXNvbHV0aW9uTGV2ZWxzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0UHJlY2luY3RXaWR0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRMZXZlbFdpZHRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldFRpbGVXaWR0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGlzVmVydGljYWxQYXJ0aXRpb25TdXBwb3J0ZWQgPVxyXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrSWZQcmVjaW5jdFBhcnRpdGlvblN0YXJ0c0luVGlsZVRvcExlZnQoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemUubnVtUmVzb2x1dGlvbkxldmVscyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3RydWN0dXJlLmdldFByZWNpbmN0V2lkdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TGV2ZWxXaWR0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRUaWxlV2lkdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlzUHJlY2luY3RQYXJ0aXRpb25GaXRzVG9UaWxlUGFydGl0aW9uICY9XHJcbiAgICAgICAgICAgICAgICAgICAgaXNIb3Jpem9udGFsUGFydGl0aW9uU3VwcG9ydGVkICYmXHJcbiAgICAgICAgICAgICAgICAgICAgaXNWZXJ0aWNhbFBhcnRpdGlvblN1cHBvcnRlZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFpc0NvbXBvbmVudHNJZGVudGljYWxTaXplKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qMmtFeGNlcHRpb25zLlVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdTcGVjaWFsIENvZGluZyBTdHlsZSBmb3IgQ29tcG9uZW50IChDT0MpJywgJ0EuNi4yJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghaXNQcmVjaW5jdFBhcnRpdGlvbkZpdHNUb1RpbGVQYXJ0aXRpb24pIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1ByZWNpbmN0IFRvcExlZnQgd2hpY2ggaXMgbm90IG1hdGNoZWQgdG8gdGlsZSBUb3BMZWZ0JywgJ0IuNicpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY2hlY2tJZlByZWNpbmN0UGFydGl0aW9uU3RhcnRzSW5UaWxlVG9wTGVmdChcclxuICAgICAgICByZXNvbHV0aW9uTGV2ZWwsXHJcbiAgICAgICAgbnVtUmVzb2x1dGlvbkxldmVscyxcclxuICAgICAgICBnZXRQcmVjaW5jdFNpemVGdW5jdGlvbixcclxuICAgICAgICBnZXRMZXZlbFNpemVGdW5jdGlvbixcclxuICAgICAgICBnZXRUaWxlU2l6ZUZ1bmN0aW9uKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gSnBlZzIwMDAgc3RhbmRhcmQgYWxsb3dzIHBhcnRpdGlvbiBvZiB0aWxlcyB3aGljaCBkb2VzIG5vdCBmaXRcclxuICAgICAgICAvLyBleGFjdGx5IHRoZSBwcmVjaW5jdHMgcGFydGl0aW9uIChpLmUuIHRoZSBmaXJzdCBwcmVjaW5jdHMgXCJ2aXJ0dWFsbHlcIlxyXG4gICAgICAgIC8vIHN0YXJ0cyBiZWZvcmUgdGhlIHRpbGUsIHRodXMgaXMgc21hbGxlciB0aGFuIG90aGVyKS5cclxuICAgICAgICAvLyBUaGlzIGlzIG5vdCBzdXBwb3J0ZWQgbm93IGluIHRoZSBjb2RlLCB0aGlzIGZ1bmN0aW9uIHNob3VsZCBjaGVja1xyXG4gICAgICAgIC8vIHRoYXQgdGhpcyBpcyBub3QgdGhlIHNpdHVhdGlvbi5cclxuICAgICAgICBcclxuICAgICAgICAvLyBUaGUgZnVuY3Rpb24gYXNzdW1lcyB0aGF0IGZpcnN0VGlsZU9mZnNldCBpcyB6ZXJvIGFuZCBjb21wb25lbnRTY2FsZVxyXG4gICAgICAgIC8vIGlzIG9uZSAoVW5zdXBwb3J0ZWRFeGNlcHRpb25zIGFyZSB0aHJvd24gaW4gQ29tcG9uZW50U3RydWN0dXJlIGFuZFxyXG4gICAgICAgIC8vIENvZGVzdHJlYW1TdHJ1Y3R1cmUgY2xhc3NlcykuXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHByZWNpbmN0U2l6ZSA9IGdldFByZWNpbmN0U2l6ZUZ1bmN0aW9uKHJlc29sdXRpb25MZXZlbCk7XHJcbiAgICAgICAgdmFyIGxldmVsU2l6ZSA9IGdldExldmVsU2l6ZUZ1bmN0aW9uKHJlc29sdXRpb25MZXZlbCk7XHJcbiAgICAgICAgdmFyIHRpbGVTaXplID0gZ2V0VGlsZVNpemVGdW5jdGlvbihyZXNvbHV0aW9uTGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChwcmVjaW5jdFNpemUgPj0gbGV2ZWxTaXplIHx8IHRpbGVTaXplID49IGxldmVsU2l6ZSkge1xyXG4gICAgICAgICAgICAvLyBwcmVjaW5jdFNpemUgPj0gbGV2ZWxTaXplID09PiBQcmVjaW5jdCBpcyBsYXJnZXIgdGhhbiBpbWFnZSB0aHVzXHJcbiAgICAgICAgICAgIC8vIGFueXdheSB0aWxlIGhhcyBhIHNpbmdsZSBwcmVjaW5jdFxyXG4gICAgICAgICAgICAvLyB0aWxlU2l6ZSA+PSBsZXZlbFNpemUgPT0+IExldmVsIGhhcyBvbmx5IHNpbmdsZSB0aWxlIHRodXMgbm9cclxuICAgICAgICAgICAgLy8gY2hhbmNlcyBmb3IgdGlsZSB0b3AtbGVmdCB0byBub3QgbWF0Y2ggZmlyc3QgcHJlY2luY3QgdG9wLWxlZnRcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgaXNQcmVjaW5jdFBhcnRpdGlvbkZpdHNUb1RpbGVQYXJ0aXRpb24gPVxyXG4gICAgICAgICAgICBwcmVjaW5jdFNpemUgJSB0aWxlU2l6ZSA9PT0gMCB8fFxyXG4gICAgICAgICAgICB0aWxlU2l6ZSAlIHByZWNpbmN0U2l6ZSA9PT0gMDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gaXNQcmVjaW5jdFBhcnRpdGlvbkZpdHNUb1RpbGVQYXJ0aXRpb247XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldFByZWNpbmN0c0luQ29kZXN0cmVhbVBhcnRQZXJMZXZlbFBlckNvbXBvbmVudChcclxuICAgICAgICB0aWxlSW5kZXgsIGNvZGVzdHJlYW1QYXJ0UGFyYW1zKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNvZGVzdHJlYW1QYXJ0UGFyYW1zID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjb21wb25lbnRzID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1Db21wb25lbnRzKCk7XHJcbiAgICAgICAgdmFyIHBlckNvbXBvbmVudFJlc3VsdCA9IG5ldyBBcnJheShjb21wb25lbnRzKTtcclxuICAgICAgICB2YXIgbWluTGV2ZWwgPVxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5sZXZlbCB8fCAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlTGVmdEluTGV2ZWwgPSBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldFRpbGVMZWZ0KFxyXG4gICAgICAgICAgICB0aWxlSW5kZXgsIG1pbkxldmVsKTtcclxuICAgICAgICB2YXIgdGlsZVRvcEluTGV2ZWwgPSBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldFRpbGVUb3AoXHJcbiAgICAgICAgICAgIHRpbGVJbmRleCwgbWluTGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBtaW5YSW5UaWxlID1cclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMubWluWCAtIHRpbGVMZWZ0SW5MZXZlbDtcclxuICAgICAgICB2YXIgbWluWUluVGlsZSA9XHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1pblkgLSB0aWxlVG9wSW5MZXZlbDtcclxuICAgICAgICB2YXIgbWF4WEluVGlsZSA9XHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1heFhFeGNsdXNpdmUgLSB0aWxlTGVmdEluTGV2ZWw7XHJcbiAgICAgICAgdmFyIG1heFlJblRpbGUgPVxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5tYXhZRXhjbHVzaXZlIC0gdGlsZVRvcEluTGV2ZWw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvZGVzdHJlYW1QYXJ0TGV2ZWxXaWR0aCA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TGV2ZWxXaWR0aChcclxuICAgICAgICAgICAgbWluTGV2ZWwpO1xyXG4gICAgICAgIHZhciBjb2Rlc3RyZWFtUGFydExldmVsSGVpZ2h0ID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRMZXZlbEhlaWdodChcclxuICAgICAgICAgICAgbWluTGV2ZWwpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBjb21wb25lbnQgPSAwOyBjb21wb25lbnQgPCBjb21wb25lbnRzOyArK2NvbXBvbmVudCkge1xyXG4gICAgICAgICAgICB2YXIgY29tcG9uZW50U3RydWN0dXJlID0gY29tcG9uZW50U3RydWN0dXJlc1tjb21wb25lbnRdO1xyXG4gICAgICAgICAgICB2YXIgbGV2ZWxzID0gY29tcG9uZW50U3RydWN0dXJlLmdldE51bVJlc29sdXRpb25MZXZlbHMoKTtcclxuICAgICAgICAgICAgdmFyIGxldmVsc0luQ29kZXN0cmVhbVBhcnQgPSBsZXZlbHMgLSBtaW5MZXZlbDtcclxuICAgICAgICAgICAgdmFyIG51bVJlc29sdXRpb25MZXZlbHMgPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUmVzb2x1dGlvbkxldmVscygpO1xyXG4gICAgICAgICAgICB2YXIgcGVyTGV2ZWxSZXN1bHQgPSBuZXcgQXJyYXkobGV2ZWxzKTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgZm9yICh2YXIgbGV2ZWwgPSAwOyBsZXZlbCA8IGxldmVsc0luQ29kZXN0cmVhbVBhcnQ7ICsrbGV2ZWwpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjb21wb25lbnRTY2FsZVggPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0Q29tcG9uZW50U2NhbGVYKCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY29tcG9uZW50U2NhbGVZID0gY29tcG9uZW50U3RydWN0dXJlLmdldENvbXBvbmVudFNjYWxlWSgpO1xyXG4gICAgICAgICAgICAgICAgdmFyIGxldmVsSW5Db2Rlc3RyZWFtUGFydCA9IGxldmVsc0luQ29kZXN0cmVhbVBhcnQgLSBsZXZlbCAtIDE7XHJcbiAgICAgICAgICAgICAgICB2YXIgbGV2ZWxTY2FsZVggPSBjb21wb25lbnRTY2FsZVggPDwgbGV2ZWxJbkNvZGVzdHJlYW1QYXJ0O1xyXG4gICAgICAgICAgICAgICAgdmFyIGxldmVsU2NhbGVZID0gY29tcG9uZW50U2NhbGVZIDw8IGxldmVsSW5Db2Rlc3RyZWFtUGFydDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHJlZHVuZGFudCA9IDQ7IC8vIFJlZHVuZGFudCBwaXhlbHMgZm9yIHdhdmVsZXQgOS03IGNvbnZvbHV0aW9uXHJcbiAgICAgICAgICAgICAgICB2YXIgbWluWEluTGV2ZWwgPSBNYXRoLmZsb29yKG1pblhJblRpbGUgLyBsZXZlbFNjYWxlWCkgLSByZWR1bmRhbnQ7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWluWUluTGV2ZWwgPSBNYXRoLmZsb29yKG1pbllJblRpbGUgLyBsZXZlbFNjYWxlWSkgLSByZWR1bmRhbnQ7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWF4WEluTGV2ZWwgPSBNYXRoLmNlaWwobWF4WEluVGlsZSAvIGxldmVsU2NhbGVYKSArIHJlZHVuZGFudDtcclxuICAgICAgICAgICAgICAgIHZhciBtYXhZSW5MZXZlbCA9IE1hdGguY2VpbChtYXhZSW5UaWxlIC8gbGV2ZWxTY2FsZVkpICsgcmVkdW5kYW50O1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgcHJlY2luY3RXaWR0aCA9XHJcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3RydWN0dXJlLmdldFByZWNpbmN0V2lkdGgobGV2ZWwpICogY29tcG9uZW50U2NhbGVYO1xyXG4gICAgICAgICAgICAgICAgdmFyIHByZWNpbmN0SGVpZ2h0ID1cclxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0UHJlY2luY3RIZWlnaHQobGV2ZWwpICogY29tcG9uZW50U2NhbGVZO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgbWluUHJlY2luY3RYID0gTWF0aC5mbG9vcihtaW5YSW5MZXZlbCAvIHByZWNpbmN0V2lkdGgpO1xyXG4gICAgICAgICAgICAgICAgdmFyIG1pblByZWNpbmN0WSA9IE1hdGguZmxvb3IobWluWUluTGV2ZWwgLyBwcmVjaW5jdEhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWF4UHJlY2luY3RYID0gTWF0aC5jZWlsKG1heFhJbkxldmVsIC8gcHJlY2luY3RXaWR0aCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWF4UHJlY2luY3RZID0gTWF0aC5jZWlsKG1heFlJbkxldmVsIC8gcHJlY2luY3RIZWlnaHQpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgcHJlY2luY3RzWCA9IGNvbXBvbmVudFN0cnVjdHVyZS5nZXROdW1QcmVjaW5jdHNYKGxldmVsKTtcclxuICAgICAgICAgICAgICAgIHZhciBwcmVjaW5jdHNZID0gY29tcG9uZW50U3RydWN0dXJlLmdldE51bVByZWNpbmN0c1kobGV2ZWwpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBwZXJMZXZlbFJlc3VsdFtsZXZlbF0gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWluUHJlY2luY3RYOiBNYXRoLm1heCgwLCBtaW5QcmVjaW5jdFgpLFxyXG4gICAgICAgICAgICAgICAgICAgIG1pblByZWNpbmN0WTogTWF0aC5tYXgoMCwgbWluUHJlY2luY3RZKSxcclxuICAgICAgICAgICAgICAgICAgICBtYXhQcmVjaW5jdFhFeGNsdXNpdmU6IE1hdGgubWluKG1heFByZWNpbmN0WCwgcHJlY2luY3RzWCksXHJcbiAgICAgICAgICAgICAgICAgICAgbWF4UHJlY2luY3RZRXhjbHVzaXZlOiBNYXRoLm1pbihtYXhQcmVjaW5jdFksIHByZWNpbmN0c1kpXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcGVyQ29tcG9uZW50UmVzdWx0W2NvbXBvbmVudF0gPSBwZXJMZXZlbFJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHBlckNvbXBvbmVudFJlc3VsdDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gdHJ5QWR2YW5jZVByZWNpbmN0SXRlcmF0b3IoXHJcbiAgICAgICAgc2V0YWJsZUl0ZXJhdG9yLFxyXG4gICAgICAgIGxldmVsLFxyXG4gICAgICAgIHByZWNpbmN0c0luQ29kZXN0cmVhbVBhcnRQZXJMZXZlbFBlckNvbXBvbmVudCxcclxuICAgICAgICBpc0l0ZXJhdGVQcmVjaW5jdHNOb3RJbkNvZGVzdHJlYW1QYXJ0KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG5lZWRBZHZhbmNlTmV4dE1lbWJlciA9IHRydWU7XHJcbiAgICAgICAgdmFyIHByZWNpbmN0c1JhbmdlSGFzaCA9IGlzSXRlcmF0ZVByZWNpbmN0c05vdEluQ29kZXN0cmVhbVBhcnQgP1xyXG4gICAgICAgICAgICBudWxsOiBwcmVjaW5jdHNJbkNvZGVzdHJlYW1QYXJ0UGVyTGV2ZWxQZXJDb21wb25lbnQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG5lZWRSZXNldFByZWNpbmN0VG9NaW5pbWFsSW5Db2Rlc3RyZWFtUGFydCA9IGZhbHNlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAodmFyIGkgPSAyOyBpID49IDA7IC0taSkge1xyXG4gICAgICAgICAgICB2YXIgbmV3VmFsdWUgPSBhZHZhbmNlUHJvZ3Jlc3Npb25PcmRlck1lbWJlcihcclxuICAgICAgICAgICAgICAgIHNldGFibGVJdGVyYXRvciwgaSwgbGV2ZWwsIHByZWNpbmN0c1JhbmdlSGFzaCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBuZWVkQWR2YW5jZU5leHRNZW1iZXIgPSBuZXdWYWx1ZSA9PT0gMDtcclxuICAgICAgICAgICAgaWYgKCFuZWVkQWR2YW5jZU5leHRNZW1iZXIpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAocHJvZ3Jlc3Npb25PcmRlcltpXSA9PT0gJ1AnICYmXHJcbiAgICAgICAgICAgICAgICAhaXNJdGVyYXRlUHJlY2luY3RzTm90SW5Db2Rlc3RyZWFtUGFydCkge1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBuZWVkUmVzZXRQcmVjaW5jdFRvTWluaW1hbEluQ29kZXN0cmVhbVBhcnQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChuZWVkQWR2YW5jZU5leHRNZW1iZXIpIHtcclxuICAgICAgICAgICAgLy8gSWYgd2UgYXJlIGhlcmUsIHRoZSBsYXN0IHByZWNpbmN0IGhhcyBiZWVuIHJlYWNoZWRcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAocHJlY2luY3RzSW5Db2Rlc3RyZWFtUGFydFBlckxldmVsUGVyQ29tcG9uZW50ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNldGFibGVJdGVyYXRvci5pc0luQ29kZXN0cmVhbVBhcnQgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJhbmdlUGVyTGV2ZWwgPVxyXG4gICAgICAgICAgICBwcmVjaW5jdHNJbkNvZGVzdHJlYW1QYXJ0UGVyTGV2ZWxQZXJDb21wb25lbnRbc2V0YWJsZUl0ZXJhdG9yLmNvbXBvbmVudF07XHJcbiAgICAgICAgdmFyIHByZWNpbmN0c1JhbmdlID0gcmFuZ2VQZXJMZXZlbFtzZXRhYmxlSXRlcmF0b3IucmVzb2x1dGlvbkxldmVsXTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAobmVlZFJlc2V0UHJlY2luY3RUb01pbmltYWxJbkNvZGVzdHJlYW1QYXJ0KSB7XHJcbiAgICAgICAgICAgIHNldGFibGVJdGVyYXRvci5wcmVjaW5jdFggPSBwcmVjaW5jdHNSYW5nZS5taW5QcmVjaW5jdFg7XHJcbiAgICAgICAgICAgICAgICBzZXRhYmxlSXRlcmF0b3IucHJlY2luY3RZID0gcHJlY2luY3RzUmFuZ2UubWluUHJlY2luY3RZO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBzZXRhYmxlSXRlcmF0b3IuaXNJbkNvZGVzdHJlYW1QYXJ0ID1cclxuICAgICAgICAgICAgc2V0YWJsZUl0ZXJhdG9yLnByZWNpbmN0WCA+PSBwcmVjaW5jdHNSYW5nZS5taW5QcmVjaW5jdFggJiZcclxuICAgICAgICAgICAgc2V0YWJsZUl0ZXJhdG9yLnByZWNpbmN0WSA+PSBwcmVjaW5jdHNSYW5nZS5taW5QcmVjaW5jdFkgJiZcclxuICAgICAgICAgICAgc2V0YWJsZUl0ZXJhdG9yLnByZWNpbmN0WCA8IHByZWNpbmN0c1JhbmdlLm1heFByZWNpbmN0WEV4Y2x1c2l2ZSAmJlxyXG4gICAgICAgICAgICBzZXRhYmxlSXRlcmF0b3IucHJlY2luY3RZIDwgcHJlY2luY3RzUmFuZ2UubWF4UHJlY2luY3RZRXhjbHVzaXZlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBhZHZhbmNlUHJvZ3Jlc3Npb25PcmRlck1lbWJlcihcclxuICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLFxyXG4gICAgICAgIG1lbWJlckluZGV4LFxyXG4gICAgICAgIGxldmVsLFxyXG4gICAgICAgIHByZWNpbmN0c1JhbmdlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvbXBvbmVudFN0cnVjdHVyZSA9IGNvbXBvbmVudFN0cnVjdHVyZXNbcHJlY2luY3RQb3NpdGlvbi5jb21wb25lbnRdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAocHJvZ3Jlc3Npb25PcmRlclttZW1iZXJJbmRleF0pIHtcclxuICAgICAgICAgICAgY2FzZSAnUic6XHJcbiAgICAgICAgICAgICAgICB2YXIgbnVtUmVzb2x1dGlvbkxldmVscyA9XHJcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3RydWN0dXJlLmdldE51bVJlc29sdXRpb25MZXZlbHMoKSAtXHJcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWw7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICsrcHJlY2luY3RQb3NpdGlvbi5yZXNvbHV0aW9uTGV2ZWw7XHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLnJlc29sdXRpb25MZXZlbCAlPSBudW1SZXNvbHV0aW9uTGV2ZWxzO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWNpbmN0UG9zaXRpb24ucmVzb2x1dGlvbkxldmVsO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSAnQyc6XHJcbiAgICAgICAgICAgICAgICArK3ByZWNpbmN0UG9zaXRpb24uY29tcG9uZW50O1xyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RQb3NpdGlvbi5jb21wb25lbnQgJT0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1Db21wb25lbnRzKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlY2luY3RQb3NpdGlvbi5jb21wb25lbnQ7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICdQJzpcclxuICAgICAgICAgICAgICAgIHZhciBtaW5YLCBtaW5ZLCBtYXhYLCBtYXhZO1xyXG4gICAgICAgICAgICAgICAgaWYgKHByZWNpbmN0c1JhbmdlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByZWNpbmN0c1JhbmdlUGVyTGV2ZWwgPSBwcmVjaW5jdHNSYW5nZVtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlY2luY3RQb3NpdGlvbi5jb21wb25lbnRdO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcmVjaW5jdHNSYW5nZUluTGV2ZWxDb21wb25lbnQgPSBwcmVjaW5jdHNSYW5nZVBlckxldmVsW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLnJlc29sdXRpb25MZXZlbF07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgbWluWCA9IHByZWNpbmN0c1JhbmdlSW5MZXZlbENvbXBvbmVudC5taW5QcmVjaW5jdFg7XHJcbiAgICAgICAgICAgICAgICAgICAgbWluWSA9IHByZWNpbmN0c1JhbmdlSW5MZXZlbENvbXBvbmVudC5taW5QcmVjaW5jdFk7XHJcbiAgICAgICAgICAgICAgICAgICAgbWF4WCA9IHByZWNpbmN0c1JhbmdlSW5MZXZlbENvbXBvbmVudC5tYXhQcmVjaW5jdFhFeGNsdXNpdmU7XHJcbiAgICAgICAgICAgICAgICAgICAgbWF4WSA9IHByZWNpbmN0c1JhbmdlSW5MZXZlbENvbXBvbmVudC5tYXhQcmVjaW5jdFlFeGNsdXNpdmU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG1pblggPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIG1pblkgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIG1heFggPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUHJlY2luY3RzWChcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlY2luY3RQb3NpdGlvbi5yZXNvbHV0aW9uTGV2ZWwpO1xyXG4gICAgICAgICAgICAgICAgICAgIG1heFkgPSBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtUHJlY2luY3RzWShcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlY2luY3RQb3NpdGlvbi5yZXNvbHV0aW9uTGV2ZWwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WCAtPSAobWluWCAtIDEpO1xyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RQb3NpdGlvbi5wcmVjaW5jdFggJT0gKG1heFggLSBtaW5YKTtcclxuICAgICAgICAgICAgICAgIHByZWNpbmN0UG9zaXRpb24ucHJlY2luY3RYICs9IG1pblg7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WCAhPSBtaW5YKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWNpbmN0UG9zaXRpb24ucHJlY2luY3RYIC0gbWluWDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RQb3NpdGlvbi5wcmVjaW5jdFkgLT0gKG1pblkgLSAxKTtcclxuICAgICAgICAgICAgICAgIHByZWNpbmN0UG9zaXRpb24ucHJlY2luY3RZICU9IChtYXhZIC0gbWluWSk7XHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WSArPSBtaW5ZO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBwcmVjaW5jdFBvc2l0aW9uLnByZWNpbmN0WSAtIG1pblk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICdMJyA6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAnQWR2YW5jaW5nIEwgaXMgbm90IHN1cHBvcnRlZCBpbiBKUElQJyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgbGV0dGVyIGluIHByb2dyZXNzaW9uIG9yZGVyOiAnICtcclxuICAgICAgICAgICAgICAgICAgICBwcm9ncmVzc2lvbk9yZGVyW21lbWJlckluZGV4XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBkZWZhdWx0Q29tcG9uZW50U3RydWN0dXJlID0ganBpcEZhY3RvcnkuY3JlYXRlQ29tcG9uZW50U3RydWN0dXJlKFxyXG4gICAgICAgIHNpemVQYXJhbXMuZGVmYXVsdENvbXBvbmVudFBhcmFtcywgdGhpcyk7XHJcbiAgICAgICAgXHJcbiAgICBjb21wb25lbnRTdHJ1Y3R1cmVzID0gbmV3IEFycmF5KGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TnVtQ29tcG9uZW50cygpKTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1Db21wb25lbnRzKCk7ICsraSkge1xyXG4gICAgICAgIGNvbXBvbmVudFN0cnVjdHVyZXNbaV0gPSBqcGlwRmFjdG9yeS5jcmVhdGVDb21wb25lbnRTdHJ1Y3R1cmUoXHJcbiAgICAgICAgICAgIHNpemVQYXJhbXMucGFyYW1zUGVyQ29tcG9uZW50W2ldLCB0aGlzKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHJlcHJvY2Vzc1BhcmFtcygpO1xyXG4gICAgXHJcbiAgICB2YWxpZGF0ZVRhcmdldFByb2dyZXNzaW9uT3JkZXIocHJvZ3Jlc3Npb25PcmRlcik7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuajJrTWFya2VycyA9IHtcclxuICAgIFN0YXJ0T2ZDb2Rlc3RyZWFtOiBbMHhGRiwgMHg0Rl0sIC8vIFNPQ1xyXG4gICAgSW1hZ2VBbmRUaWxlU2l6ZTogWzB4RkYsIDB4NTFdLCAvLyBTSVpcclxuICAgIENvZGluZ1N0eWxlRGVmYXVsdDogWzB4RkYsIDB4NTJdLCAvLyBDT0RcclxuICAgIENvZGluZ1N0eWxlQ29tcG9uZW50OiBbMHhGRiwgMHg1M10sIC8vIENPQ1xyXG4gICAgUXVhbnRpemF0aW9uRGVmYXVsdDogWzB4RkYsIDB4NUNdLCAvLyBRQ0RcclxuICAgIFByb2dyZXNzaW9uT3JkZXJDaGFuZ2U6IFsweEZGLCAweDVGXSwgLy8gUE9DXHJcbiAgICBQYWNrZWRQYWNrZXRIZWFkZXJzSW5NYWluSGVhZGVyOiBbMHhGRiwgMHg2MF0sIC8vIFBQTVxyXG4gICAgUGFja2VkUGFja2V0SGVhZGVyc0luVGlsZUhlYWRlcjogWzB4RkYsIDB4NjFdLCAvLyBQUFRcclxuICAgIFN0YXJ0T2ZUaWxlOiBbMHhGRiwgMHg5MF0sIC8vIFNPVFxyXG4gICAgU3RhcnRPZkRhdGE6IFsweEZGLCAweDkzXSwgLy8gU09EXHJcbiAgICBFbmRPZkNvZGVzdHJlYW06IFsweEZGLCAweEQ5XSwgLy8gRU9DXHJcbiAgICBDb21tZW50OiBbMHhGRiwgMHg2NF0gLy8gQ09NXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5qMmtPZmZzZXRzID0ge1xyXG4gICAgTUFSS0VSX1NJWkU6IDIsXHJcbiAgICBMRU5HVEhfRklFTERfU0laRTogMixcclxuICAgIFxyXG4gICAgTlVNX0NPTVBPTkVOVFNfT0ZGU0VUX0FGVEVSX1NJWl9NQVJLRVI6IDM4LFxyXG4gICAgUkVGRVJFTkNFX0dSSURfU0laRV9PRkZTRVRfQUZURVJfU0laX01BUktFUjogNlxyXG5cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLmpwaXBFbmRPZlJlc3BvbnNlUmVhc29ucyA9IHtcclxuICAgIElNQUdFX0RPTkUgOiAxLFxyXG4gICAgV0lORE9XX0RPTkUgOiAyLFxyXG4gICAgV0lORE9XX0NIQU5HRSA6IDMsXHJcbiAgICBCWVRFX0xJTUlUIDogNCxcclxuICAgIFFVQUxJVFlfTElNSVQgOiA1LFxyXG4gICAgU0VTU0lPTl9MSU1JVCA6IDYsXHJcbiAgICBSRVNQT05TRV9MSU1JVCA6IDcsXHJcbiAgICBOT05fU1BFQ0lGSUVEIDogOFxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMuajJrRXhjZXB0aW9ucyA9IHtcclxuICAgIFVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbjogZnVuY3Rpb24oZmVhdHVyZSwgc3RhbmRhcmRTZWN0aW9uKSB7XHJcbiAgICAgICAgdGhpcy5kZXNjcmlwdGlvbiA9IGZlYXR1cmUgKyAnIChzcGVjaWZpZWQgaW4gc2VjdGlvbiAnICsgc3RhbmRhcmRTZWN0aW9uICsgJyBvZiBwYXJ0IDE6IENvcmUgQ29kaW5nIFN5c3RlbSBzdGFuZGFyZCkgaXMgbm90IHN1cHBvcnRlZCB5ZXQnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdKMmsgVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uOiAnICsgdGhpcy5kZXNjcmlwdGlvbjtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBQYXJzZUV4Y2VwdGlvbjogZnVuY3Rpb24oZGVzY3JpcHRpb24pIHtcclxuICAgICAgICB0aGlzLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ0oyayBQYXJzZUV4Y2VwdGlvbjogJyArIHRoaXMuZGVzY3JpcHRpb247XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgSWxsZWdhbERhdGFFeGNlcHRpb246IGZ1bmN0aW9uKGlsbGVnYWxEYXRhRGVzY3JpcHRpb24sIHN0YW5kYXJkU2VjdGlvbikge1xyXG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBpbGxlZ2FsRGF0YURlc2NyaXB0aW9uICsgJyAoc2VlIHNlY3Rpb24gJyArIHN0YW5kYXJkU2VjdGlvbiArICcgb2YgcGFydCA5OiBJbnRlcmFjdGl2aXR5IHRvb2xzLCBBUElzIGFuZCBQcm90b2NvbHMpJztcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnSjJrIElsbGVnYWxEYXRhRXhjZXB0aW9uOiAnICsgdGhpcy5kZXNjcmlwdGlvbjtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMuanBpcEV4Y2VwdGlvbnMgPSB7XHJcbiAgICBVbnN1cHBvcnRlZEZlYXR1cmVFeGNlcHRpb246IGZ1bmN0aW9uKGZlYXR1cmUsIHN0YW5kYXJkU2VjdGlvbikge1xyXG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBmZWF0dXJlICsgJyAoc3BlY2lmaWVkIGluIHNlY3Rpb24gJyArIHN0YW5kYXJkU2VjdGlvbiArICcgb2YgcGFydCA5OiBJbnRlcmFjdGl2aXR5IHRvb2xzLCBBUElzIGFuZCBQcm90b2NvbHMpIGlzIG5vdCBzdXBwb3J0ZWQgeWV0JztcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnSnBpcCBVbnN1cHBvcnRlZEZlYXR1cmVFeGNlcHRpb246ICcgKyB0aGlzLmRlc2NyaXB0aW9uO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIFBhcnNlRXhjZXB0aW9uOiBmdW5jdGlvbihkZXNjcmlwdGlvbikge1xyXG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnSnBpcCBQYXJzZUV4Y2VwdGlvbjogJyArIHRoaXMuZGVzY3JpcHRpb247XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgSWxsZWdhbERhdGFFeGNlcHRpb246IGZ1bmN0aW9uKGlsbGVnYWxEYXRhRGVzY3JpcHRpb24sIHN0YW5kYXJkU2VjdGlvbikge1xyXG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBpbGxlZ2FsRGF0YURlc2NyaXB0aW9uICsgJyAoc2VlIHNlY3Rpb24gJyArIHN0YW5kYXJkU2VjdGlvbiArICcgb2YgcGFydCA5OiBJbnRlcmFjdGl2aXR5IHRvb2xzLCBBUElzIGFuZCBQcm90b2NvbHMpJztcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnSnBpcCBJbGxlZ2FsRGF0YUV4Y2VwdGlvbjogJyArIHRoaXMuZGVzY3JpcHRpb247XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcbiAgICBcclxuICAgIElsbGVnYWxPcGVyYXRpb25FeGNlcHRpb246IGZ1bmN0aW9uKGRlc2NyaXB0aW9uKSB7XHJcbiAgICAgICAgdGhpcy5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdKcGlwIElsbGVnYWxPcGVyYXRpb25FeGNlcHRpb246ICcgKyB0aGlzLmRlc2NyaXB0aW9uO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBBcmd1bWVudEV4Y2VwdGlvbjogZnVuY3Rpb24oYXJndW1lbnROYW1lLCBhcmd1bWVudFZhbHVlLCBkZXNjcmlwdGlvbikge1xyXG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSAnQXJndW1lbnQgJyArIGFyZ3VtZW50TmFtZSArICcgaGFzIGludmFsaWQgdmFsdWUgJyArXHJcbiAgICAgICAgICAgIGFyZ3VtZW50VmFsdWUgKyAoZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCA/ICcgOicgKyBkZXNjcmlwdGlvbiA6ICcnKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnSnBpcCBBcmd1bWVudEV4Y2VwdGlvbjogJyArIHRoaXMuZGVzY3JpcHRpb247XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgV3JvbmdTdHJlYW1FeGNlcHRpb246IGZ1bmN0aW9uKHJlcXVlc3RlZE9wZXJhdGlvbiwgaXNKUFQpIHtcclxuICAgICAgICB2YXIgY29ycmVjdFN0cmVhbSA9ICdKUFAgKEpQSVAgUHJlY2luY3QpJztcclxuICAgICAgICB2YXIgd3JvbmdTdHJlYW0gPSAnSlBUIChKUElQIFRpbGUtcGFydCknO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc0pQVCkge1xyXG4gICAgICAgICAgICB2YXIgc3dhcCA9IGNvcnJlY3RTdHJlYW07XHJcbiAgICAgICAgICAgIGNvcnJlY3RTdHJlYW0gPSB3cm9uZ1N0cmVhbTtcclxuICAgICAgICAgICAgd3JvbmdTdHJlYW0gPSBzd2FwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmRlc2NyaXB0aW9uID0gICAgJ1N0cmVhbSB0eXBlIGlzICcgKyB3cm9uZ1N0cmVhbSArICcsIGJ1dCAnICsgcmVxdWVzdGVkT3BlcmF0aW9uICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgaXMgYWxsb3dlZCBvbmx5IGluICcgKyBjb3JyZWN0U3RyZWFtICsgJyBzdHJlYW0nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgdGhpcy50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ0pwaXAgV3JvbmdTdHJlYW1FeGNlcHRpb246ICcgKyB0aGlzLmRlc2NyaXB0aW9uO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIEludGVybmFsRXJyb3JFeGNlcHRpb246IGZ1bmN0aW9uKGRlc2NyaXB0aW9uKSB7XHJcbiAgICAgICAgdGhpcy5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdKcGlwIEludGVybmFsRXJyb3JFeGNlcHRpb246ICcgKyB0aGlzLmRlc2NyaXB0aW9uO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5qMmtFeGNlcHRpb25zLlVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbi5OYW1lID1cclxuICAgICdqMmtFeGNlcHRpb25zLlVuc3VwcG9ydGVkRmVhdHVyZUV4Y2VwdGlvbic7XHJcbm1vZHVsZS5leHBvcnRzLmoya0V4Y2VwdGlvbnMuUGFyc2VFeGNlcHRpb24uTmFtZSA9XHJcbiAgICAnajJrRXhjZXB0aW9ucy5QYXJzZUV4Y2VwdGlvbic7XHJcbm1vZHVsZS5leHBvcnRzLmoya0V4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24uTmFtZSA9XHJcbiAgICAnajJrRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbic7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5qcGlwRXhjZXB0aW9ucy5VbnN1cHBvcnRlZEZlYXR1cmVFeGNlcHRpb24uTmFtZSA9XHJcbiAgICAnanBpcEV4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uJztcclxubW9kdWxlLmV4cG9ydHMuanBpcEV4Y2VwdGlvbnMuUGFyc2VFeGNlcHRpb24uTmFtZSA9XHJcbiAgICAnanBpcEV4Y2VwdGlvbnMuUGFyc2VFeGNlcHRpb24nO1xyXG5tb2R1bGUuZXhwb3J0cy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbi5OYW1lID1cclxuICAgICdqcGlwRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbic7XHJcbm1vZHVsZS5leHBvcnRzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxPcGVyYXRpb25FeGNlcHRpb24uTmFtZSA9XHJcbiAgICAnanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbic7XHJcbm1vZHVsZS5leHBvcnRzLmpwaXBFeGNlcHRpb25zLkFyZ3VtZW50RXhjZXB0aW9uLk5hbWUgPVxyXG4gICAgJ2pwaXBFeGNlcHRpb25zLkFyZ3VtZW50RXhjZXB0aW9uJztcclxubW9kdWxlLmV4cG9ydHMuanBpcEV4Y2VwdGlvbnMuV3JvbmdTdHJlYW1FeGNlcHRpb24uTmFtZSA9XHJcbiAgICAnanBpcEV4Y2VwdGlvbnMuV3JvbmdTdHJlYW1FeGNlcHRpb24nO1xyXG5tb2R1bGUuZXhwb3J0cy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uLk5hbWUgPVxyXG4gICAgJ2pwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24nOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBzaW1wbGVBamF4SGVscGVyICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ3NpbXBsZS1hamF4LWhlbHBlci5qcycgICAgICAgICAgICAgICAgICk7XHJcbnZhciBtdXR1YWxFeGNsdXNpdmVUcmFuc2FjdGlvbkhlbHBlciA9IHJlcXVpcmUoJ211dHVhbC1leGNsdXNpdmUtdHJhbnNhY3Rpb24taGVscGVyLmpzJyk7XHJcblxyXG52YXIganBpcENvZGluZ1Bhc3Nlc051bWJlclBhcnNlciA9IHJlcXVpcmUoJ2pwaXAtY29kaW5nLXBhc3Nlcy1udW1iZXItcGFyc2VyLmpzJyk7XHJcbnZhciBqcGlwTWVzc2FnZUhlYWRlclBhcnNlciAgICAgID0gcmVxdWlyZSgnanBpcC1tZXNzYWdlLWhlYWRlci1wYXJzZXIuanMnICAgICAgKTtcclxuXHJcbnZhciBKcGlwQ2hhbm5lbCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtY2hhbm5lbC5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwQ29kZXN0cmVhbVJlY29uc3RydWN0b3IgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtY29kZXN0cmVhbS1yZWNvbnN0cnVjdG9yLmpzJyAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwQ29kZXN0cmVhbVN0cnVjdHVyZSAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtY29kZXN0cmVhbS1zdHJ1Y3R1cmUuanMnICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwQ29tcG9uZW50U3RydWN0dXJlICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtY29tcG9uZW50LXN0cnVjdHVyZS5qcycgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBDb21wb3NpdGVBcnJheSAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2NvbXBvc2l0ZS1hcnJheS5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwRGF0YWJpblBhcnRzICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtZGF0YWJpbi1wYXJ0cy5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwRGF0YWJpbnNTYXZlciAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtZGF0YWJpbnMtc2F2ZXIuanMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwRmV0Y2ggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtZmV0Y2guanMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwSGVhZGVyTW9kaWZpZXIgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtaGVhZGVyLW1vZGlmaWVyLmpzJyAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwSW1hZ2VEYXRhQ29udGV4dCAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtaW1hZ2UtZGF0YS1jb250ZXh0LmpzJyAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwTGV2ZWxDYWxjdWxhdG9yICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtbGV2ZWwtY2FsY3VsYXRvci5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwTWFya2Vyc1BhcnNlciAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtbWFya2Vycy1wYXJzZXIuanMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwT2JqZWN0UG9vbEJ5RGF0YWJpbiAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtb2JqZWN0LXBvb2wtYnktZGF0YWJpbi5qcycgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwT2Zmc2V0c0NhbGN1bGF0b3IgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtb2Zmc2V0cy1jYWxjdWxhdG9yLmpzJyAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwUGFja2V0c0RhdGFDb2xsZWN0b3IgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcGFja2V0cy1kYXRhLWNvbGxlY3Rvci5qcycgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwUmVxdWVzdERhdGFiaW5zTGlzdGVuZXIgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcmVxdWVzdC1kYXRhYmlucy1saXN0ZW5lci5qcycgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwUmVxdWVzdFBhcmFtc01vZGlmaWVyICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcmVxdWVzdC1wYXJhbXMtbW9kaWZpZXIuanMnICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwUmVxdWVzdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcmVxdWVzdC5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwU2Vzc2lvbkhlbHBlciAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtc2Vzc2lvbi1oZWxwZXIuanMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwU2Vzc2lvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtc2Vzc2lvbi5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwUmVjb25uZWN0YWJsZVJlcXVlc3RlciAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcmVjb25uZWN0YWJsZS1yZXF1ZXN0ZXIuanMnICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwU3RydWN0dXJlUGFyc2VyICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtc3RydWN0dXJlLXBhcnNlci5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwVGlsZVN0cnVjdHVyZSAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtdGlsZS1zdHJ1Y3R1cmUuanMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwQml0c3RyZWFtUmVhZGVyICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtYml0c3RyZWFtLXJlYWRlci5qcycgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwVGFnVHJlZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtdGFnLXRyZWUuanMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwQ29kZWJsb2NrTGVuZ3RoUGFyc2VyICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtY29kZWJsb2NrLWxlbmd0aC1wYXJzZXIuanMnICAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwU3ViYmFuZExlbmd0aEluUGFja2V0SGVhZGVyQ2FsY3VsYXRvciA9IHJlcXVpcmUoJ2pwaXAtc3ViYmFuZC1sZW5ndGgtaW4tcGFja2V0LWhlYWRlci1jYWxjdWxhdG9yLmpzJyk7XHJcbnZhciBKcGlwUGFja2V0TGVuZ3RoQ2FsY3VsYXRvciAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcGFja2V0LWxlbmd0aC1jYWxjdWxhdG9yLmpzJyAgICAgICAgICAgICAgICAgICk7XHJcbnZhciBKcGlwUXVhbGl0eUxheWVyc0NhY2hlICAgICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ2pwaXAtcXVhbGl0eS1sYXllcnMtY2FjaGUuanMnICAgICAgICAgICAgICAgICAgICAgICk7XHJcblxyXG52YXIgSnBpcEZldGNoZXI7XHJcblxyXG52YXIganBpcFJ1bnRpbWVGYWN0b3J5ID0ge1xyXG4gICAgY3JlYXRlQ2hhbm5lbDogZnVuY3Rpb24gY3JlYXRlQ2hhbm5lbChcclxuICAgICAgICBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCwgc2Vzc2lvbkhlbHBlcikge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcENoYW5uZWwoXHJcbiAgICAgICAgICAgIG1heFJlcXVlc3RzV2FpdGluZ0ZvclJlc3BvbnNlSW5DaGFubmVsLFxyXG4gICAgICAgICAgICBzZXNzaW9uSGVscGVyLFxyXG4gICAgICAgICAgICBqcGlwUnVudGltZUZhY3RvcnkpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlQ29kZXN0cmVhbVJlY29uc3RydWN0b3I6IGZ1bmN0aW9uKFxyXG4gICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsIGRhdGFiaW5zU2F2ZXIsIGhlYWRlck1vZGlmaWVyLCBxdWFsaXR5TGF5ZXJzQ2FjaGUpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBDb2Rlc3RyZWFtUmVjb25zdHJ1Y3RvcihcclxuICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgICAgICAgICAgZGF0YWJpbnNTYXZlcixcclxuICAgICAgICAgICAgaGVhZGVyTW9kaWZpZXIsXHJcbiAgICAgICAgICAgIHF1YWxpdHlMYXllcnNDYWNoZSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVMZXZlbENhbGN1bGF0b3I6IGZ1bmN0aW9uKHBhcmFtcykge1xyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcExldmVsQ2FsY3VsYXRvcihwYXJhbXMpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlQ29kZXN0cmVhbVN0cnVjdHVyZTogZnVuY3Rpb24oc3RydWN0dXJlUGFyc2VyLCBwcm9ncmVzc2lvbk9yZGVyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwQ29kZXN0cmVhbVN0cnVjdHVyZShcclxuICAgICAgICAgICAgc3RydWN0dXJlUGFyc2VyLCBqcGlwUnVudGltZUZhY3RvcnksIHByb2dyZXNzaW9uT3JkZXIpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlQ29tcG9uZW50U3RydWN0dXJlOiBmdW5jdGlvbihwYXJhbXMsIHRpbGVTdHJ1Y3R1cmUpIHtcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBDb21wb25lbnRTdHJ1Y3R1cmUocGFyYW1zLCB0aWxlU3RydWN0dXJlKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZUNvbXBvc2l0ZUFycmF5OiBmdW5jdGlvbihvZmZzZXQpIHtcclxuICAgICAgICByZXR1cm4gbmV3IENvbXBvc2l0ZUFycmF5KG9mZnNldCk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVEYXRhYmluUGFydHM6IGZ1bmN0aW9uKGNsYXNzSWQsIGluQ2xhc3NJZCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcERhdGFiaW5QYXJ0cyhjbGFzc0lkLCBpbkNsYXNzSWQsIGpwaXBSdW50aW1lRmFjdG9yeSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVEYXRhYmluc1NhdmVyOiBmdW5jdGlvbihpc0pwaXBUaWxlcGFydFN0cmVhbSkge1xyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcERhdGFiaW5zU2F2ZXIoaXNKcGlwVGlsZXBhcnRTdHJlYW0sIGpwaXBSdW50aW1lRmFjdG9yeSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVGZXRjaGVyOiBmdW5jdGlvbihkYXRhYmluc1NhdmVyLCBvcHRpb25zKSB7XHJcbiAgICAgICAgaWYgKCFKcGlwRmV0Y2hlcikge1xyXG4gICAgICAgICAgICAvLyBBdm9pZCBkZXBlbmRlbmN5IC0gbG9hZCBvbmx5IG9uIHJ1bnRpbWVcclxuICAgICAgICAgICAgSnBpcEZldGNoZXIgPSByZXF1aXJlKCdqcGlwLWZldGNoZXIuanMnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwRmV0Y2hlcihkYXRhYmluc1NhdmVyLCBvcHRpb25zKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZUZldGNoOiBmdW5jdGlvbihmZXRjaENvbnRleHQsIHJlcXVlc3RlciwgcHJvZ3Jlc3NpdmVuZXNzKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwRmV0Y2goZmV0Y2hDb250ZXh0LCByZXF1ZXN0ZXIsIHByb2dyZXNzaXZlbmVzcyk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVIZWFkZXJNb2RpZmllcjogZnVuY3Rpb24oXHJcbiAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSwgb2Zmc2V0c0NhbGN1bGF0b3IsIHByb2dyZXNzaW9uT3JkZXIpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBIZWFkZXJNb2RpZmllcihcclxuICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSwgb2Zmc2V0c0NhbGN1bGF0b3IsIHByb2dyZXNzaW9uT3JkZXIpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlSW1hZ2VEYXRhQ29udGV4dDogZnVuY3Rpb24oXHJcbiAgICAgICAganBpcE9iamVjdHMsIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLCBwcm9ncmVzc2l2ZW5lc3MpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBJbWFnZURhdGFDb250ZXh0KFxyXG4gICAgICAgICAgICBqcGlwT2JqZWN0cywgY29kZXN0cmVhbVBhcnRQYXJhbXMsIHByb2dyZXNzaXZlbmVzcyk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVNYXJrZXJzUGFyc2VyOiBmdW5jdGlvbihtYWluSGVhZGVyRGF0YWJpbikge1xyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcE1hcmtlcnNQYXJzZXIoXHJcbiAgICAgICAgICAgIG1haW5IZWFkZXJEYXRhYmluLCBqcGlwTWVzc2FnZUhlYWRlclBhcnNlciwganBpcFJ1bnRpbWVGYWN0b3J5KTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZU9iamVjdFBvb2xCeURhdGFiaW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcE9iamVjdFBvb2xCeURhdGFiaW4oKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZU9mZnNldHNDYWxjdWxhdG9yOiBmdW5jdGlvbihtYWluSGVhZGVyRGF0YWJpbiwgbWFya2Vyc1BhcnNlcikge1xyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcE9mZnNldHNDYWxjdWxhdG9yKG1haW5IZWFkZXJEYXRhYmluLCBtYXJrZXJzUGFyc2VyKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZVBhY2tldHNEYXRhQ29sbGVjdG9yOiBmdW5jdGlvbihcclxuICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLCBkYXRhYmluc1NhdmVyLCBxdWFsaXR5TGF5ZXJzQ2FjaGUpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBQYWNrZXRzRGF0YUNvbGxlY3RvcihcclxuICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgICAgICAgICAgZGF0YWJpbnNTYXZlcixcclxuICAgICAgICAgICAgcXVhbGl0eUxheWVyc0NhY2hlLFxyXG4gICAgICAgICAgICBqcGlwUnVudGltZUZhY3RvcnkpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlUmVxdWVzdERhdGFiaW5zTGlzdGVuZXI6IGZ1bmN0aW9uIGNyZWF0ZVJlcXVlc3REYXRhYmluc0xpc3RlbmVyKFxyXG4gICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgIHF1YWxpdHlMYXllclJlYWNoZWRDYWxsYmFjayxcclxuICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgICAgIGRhdGFiaW5zU2F2ZXIsXHJcbiAgICAgICAgcXVhbGl0eUxheWVyc0NhY2hlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwUmVxdWVzdERhdGFiaW5zTGlzdGVuZXIoXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgICAgICBxdWFsaXR5TGF5ZXJSZWFjaGVkQ2FsbGJhY2ssXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICAgICAgICAgIGRhdGFiaW5zU2F2ZXIsXHJcbiAgICAgICAgICAgIHF1YWxpdHlMYXllcnNDYWNoZSxcclxuICAgICAgICAgICAganBpcFJ1bnRpbWVGYWN0b3J5KTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZVJlcXVlc3RQYXJhbXNNb2RpZmllcjogZnVuY3Rpb24gY3JlYXRlUmVxdWVzdFBhcmFtc01vZGlmaWVyKFxyXG4gICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBSZXF1ZXN0UGFyYW1zTW9kaWZpZXIoY29kZXN0cmVhbVN0cnVjdHVyZSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVSZXF1ZXN0OiBmdW5jdGlvbiBjcmVhdGVSZXF1ZXN0KFxyXG4gICAgICAgIHNlc3Npb25IZWxwZXIsIGNoYW5uZWwsIHJlcXVlc3RVcmwsIGNhbGxiYWNrLCBmYWlsdXJlQ2FsbGJhY2spIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBSZXF1ZXN0KFxyXG4gICAgICAgICAgICBzZXNzaW9uSGVscGVyLFxyXG4gICAgICAgICAgICBqcGlwTWVzc2FnZUhlYWRlclBhcnNlcixcclxuICAgICAgICAgICAgY2hhbm5lbCxcclxuICAgICAgICAgICAgcmVxdWVzdFVybCxcclxuICAgICAgICAgICAgY2FsbGJhY2ssXHJcbiAgICAgICAgICAgIGZhaWx1cmVDYWxsYmFjayk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVTZXNzaW9uSGVscGVyOiBmdW5jdGlvbiBjcmVhdGVTZXNzaW9uSGVscGVyKFxyXG4gICAgICAgIGRhdGFSZXF1ZXN0VXJsLFxyXG4gICAgICAgIGtub3duVGFyZ2V0SWQsXHJcbiAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgICAgICBkYXRhYmluc1NhdmVyKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwU2Vzc2lvbkhlbHBlcihcclxuICAgICAgICAgICAgZGF0YVJlcXVlc3RVcmwsXHJcbiAgICAgICAgICAgIGtub3duVGFyZ2V0SWQsXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICAgICAgICAgIGRhdGFiaW5zU2F2ZXIsXHJcbiAgICAgICAgICAgIHNpbXBsZUFqYXhIZWxwZXIpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlU2Vzc2lvbjogZnVuY3Rpb24gY3JlYXRlU2Vzc2lvbihcclxuICAgICAgICBtYXhDaGFubmVsc0luU2Vzc2lvbixcclxuICAgICAgICBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCxcclxuICAgICAgICB0YXJnZXRJZCxcclxuICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgICAgIGRhdGFiaW5zU2F2ZXIpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBTZXNzaW9uKFxyXG4gICAgICAgICAgICBtYXhDaGFubmVsc0luU2Vzc2lvbixcclxuICAgICAgICAgICAgbWF4UmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VJbkNoYW5uZWwsXHJcbiAgICAgICAgICAgIHRhcmdldElkLFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgICAgICAgICBkYXRhYmluc1NhdmVyLFxyXG4gICAgICAgICAgICBzZXRJbnRlcnZhbCxcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCxcclxuICAgICAgICAgICAganBpcFJ1bnRpbWVGYWN0b3J5KTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZVJlY29ubmVjdGFibGVSZXF1ZXN0ZXI6IGZ1bmN0aW9uKFxyXG4gICAgICAgIG1heENoYW5uZWxzSW5TZXNzaW9uLFxyXG4gICAgICAgIG1heFJlcXVlc3RzV2FpdGluZ0ZvclJlc3BvbnNlSW5DaGFubmVsLFxyXG4gICAgICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICAgICAgZGF0YWJpbnNTYXZlcikge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgSnBpcFJlY29ubmVjdGFibGVSZXF1ZXN0ZXIoXHJcbiAgICAgICAgICAgIG1heENoYW5uZWxzSW5TZXNzaW9uLFxyXG4gICAgICAgICAgICBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCxcclxuICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgICAgICAgICAgZGF0YWJpbnNTYXZlcixcclxuICAgICAgICAgICAganBpcFJ1bnRpbWVGYWN0b3J5KTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZVN0cnVjdHVyZVBhcnNlcjogZnVuY3Rpb24oZGF0YWJpbnNTYXZlciwgbWFya2Vyc1BhcnNlciwgb2Zmc2V0c0NhbGN1bGF0b3IpIHtcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBTdHJ1Y3R1cmVQYXJzZXIoXHJcbiAgICAgICAgICAgIGRhdGFiaW5zU2F2ZXIsIG1hcmtlcnNQYXJzZXIsIGpwaXBNZXNzYWdlSGVhZGVyUGFyc2VyLCBvZmZzZXRzQ2FsY3VsYXRvcik7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVUaWxlU3RydWN0dXJlOiBmdW5jdGlvbihcclxuICAgICAgICBzaXplUGFyYW1zLCBjb2Rlc3RyZWFtU3RydWN0dXJlLCBwcm9ncmVzc2lvbk9yZGVyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwVGlsZVN0cnVjdHVyZShcclxuICAgICAgICAgICAgc2l6ZVBhcmFtcywgY29kZXN0cmVhbVN0cnVjdHVyZSwganBpcFJ1bnRpbWVGYWN0b3J5LCBwcm9ncmVzc2lvbk9yZGVyKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZUJpdHN0cmVhbVJlYWRlcjogZnVuY3Rpb24gY3JlYXRlQml0c3RyZWFtUmVhZGVyKGRhdGFiaW4pIHtcclxuICAgICAgICByZXR1cm4gbmV3IEpwaXBCaXRzdHJlYW1SZWFkZXIoXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIG11dHVhbEV4Y2x1c2l2ZVRyYW5zYWN0aW9uSGVscGVyKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZVRhZ1RyZWU6IGZ1bmN0aW9uIGNyZWF0ZVRhZ1RyZWUoYml0c3RyZWFtUmVhZGVyLCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwVGFnVHJlZShcclxuICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLCB3aWR0aCwgaGVpZ2h0LCBtdXR1YWxFeGNsdXNpdmVUcmFuc2FjdGlvbkhlbHBlcik7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVDb2RlYmxvY2tMZW5ndGhQYXJzZXI6IGZ1bmN0aW9uIGNyZWF0ZUNvZGVibG9ja0xlbmd0aFBhcnNlcihcclxuICAgICAgICBiaXRzdHJlYW1SZWFkZXIsIHRyYW5zYWN0aW9uSGVscGVyKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwQ29kZWJsb2NrTGVuZ3RoUGFyc2VyKFxyXG4gICAgICAgICAgICBiaXRzdHJlYW1SZWFkZXIsIG11dHVhbEV4Y2x1c2l2ZVRyYW5zYWN0aW9uSGVscGVyKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGNyZWF0ZVN1YmJhbmRMZW5ndGhJblBhY2tldEhlYWRlckNhbGN1bGF0b3IgOlxyXG4gICAgICAgIGZ1bmN0aW9uIGNyZWF0ZVN1YmJhbmRMZW5ndGhJblBhY2tldEhlYWRlckNhbGN1bGF0b3IoXHJcbiAgICAgICAgICAgIGJpdHN0cmVhbVJlYWRlciwgbnVtQ29kZWJsb2Nrc1hJblN1YmJhbmQsIG51bUNvZGVibG9ja3NZSW5TdWJiYW5kKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwU3ViYmFuZExlbmd0aEluUGFja2V0SGVhZGVyQ2FsY3VsYXRvcihcclxuICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLFxyXG4gICAgICAgICAgICBudW1Db2RlYmxvY2tzWEluU3ViYmFuZCxcclxuICAgICAgICAgICAgbnVtQ29kZWJsb2Nrc1lJblN1YmJhbmQsXHJcbiAgICAgICAgICAgIGpwaXBDb2RpbmdQYXNzZXNOdW1iZXJQYXJzZXIsXHJcbiAgICAgICAgICAgIG11dHVhbEV4Y2x1c2l2ZVRyYW5zYWN0aW9uSGVscGVyLFxyXG4gICAgICAgICAgICBqcGlwUnVudGltZUZhY3RvcnkpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY3JlYXRlUGFja2V0TGVuZ3RoQ2FsY3VsYXRvcjogZnVuY3Rpb24gY3JlYXRlUGFja2V0TGVuZ3RoQ2FsY3VsYXRvcihcclxuICAgICAgICB0aWxlU3RydWN0dXJlLFxyXG4gICAgICAgIGNvbXBvbmVudFN0cnVjdHVyZSxcclxuICAgICAgICBkYXRhYmluLFxyXG4gICAgICAgIHN0YXJ0T2Zmc2V0SW5EYXRhYmluLFxyXG4gICAgICAgIHByZWNpbmN0KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwUGFja2V0TGVuZ3RoQ2FsY3VsYXRvcihcclxuICAgICAgICAgICAgdGlsZVN0cnVjdHVyZSxcclxuICAgICAgICAgICAgY29tcG9uZW50U3RydWN0dXJlLFxyXG4gICAgICAgICAgICBkYXRhYmluLFxyXG4gICAgICAgICAgICBzdGFydE9mZnNldEluRGF0YWJpbixcclxuICAgICAgICAgICAgcHJlY2luY3QsXHJcbiAgICAgICAgICAgIGpwaXBSdW50aW1lRmFjdG9yeSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVRdWFsaXR5TGF5ZXJzQ2FjaGU6IGZ1bmN0aW9uIGNyZWF0ZVF1YWxpdHlMYXllcnNDYWNoZShcclxuICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBKcGlwUXVhbGl0eUxheWVyc0NhY2hlKFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgICAgICAgICBqcGlwUnVudGltZUZhY3RvcnkpO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBqcGlwUnVudGltZUZhY3Rvcnk7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICByZXF1ZXN0OiBmdW5jdGlvbiByZXF1ZXN0KFxyXG4gICAgICAgIHVybCxcclxuICAgICAgICBjYWxsYmFja0ZvckFzeW5jaHJvbm91c1JlcXVlc3QsXHJcbiAgICAgICAgZmFpbHVyZUNhbGxiYWNrRm9yQXN5bmNocm9ub3VzUmVxdWVzdCxcclxuICAgICAgICBwcm9ncmVzc2l2ZVJlcXVlc3RRdWFudEJ5dGVzKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGFqYXhSZXNwb25zZSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgIHZhciBpc1N5bmNocm9ub3VzID0gY2FsbGJhY2tGb3JBc3luY2hyb25vdXNSZXF1ZXN0ID09PSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIHZhciBpc0ZpbmlzaGVkUmVxdWVzdCA9IGZhbHNlO1xyXG4gICAgICAgIHZhciBieXRlc1JlY2lldmVkT25MYXN0UXVhbnQgPSAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZ1bmN0aW9uIGludGVybmFsQWpheENhbGxiYWNrKGUpIHtcclxuICAgICAgICAgICAgaWYgKGlzRmluaXNoZWRSZXF1ZXN0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChhamF4UmVzcG9uc2UucmVhZHlTdGF0ZSAhPT0gNCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzaXZlUmVxdWVzdFF1YW50Qnl0ZXMgPT09IHVuZGVmaW5lZCB8fFxyXG4gICAgICAgICAgICAgICAgICAgIGFqYXhSZXNwb25zZS5yZXNwb25zZSA9PT0gbnVsbCB8fFxyXG4gICAgICAgICAgICAgICAgICAgIGFqYXhSZXNwb25zZS5yZWFkeVN0YXRlIDwgMykge1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGJ5dGVzUmVjaWV2ZWQgPSBhamF4UmVzcG9uc2UucmVzcG9uc2UuYnl0ZUxlbmd0aDtcclxuICAgICAgICAgICAgICAgIHZhciBieXRlc1RpbGxMYXN0UXVhbnQgPSBieXRlc1JlY2lldmVkIC0gYnl0ZXNSZWNpZXZlZE9uTGFzdFF1YW50O1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoYnl0ZXNUaWxsTGFzdFF1YW50IDwgcHJvZ3Jlc3NpdmVSZXF1ZXN0UXVhbnRCeXRlcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYnl0ZXNSZWNpZXZlZE9uTGFzdFF1YW50ID0gYnl0ZXNSZWNpZXZlZDtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlzRmluaXNoZWRSZXF1ZXN0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGFqYXhSZXNwb25zZS5zdGF0dXMgIT09IDIwMCB8fFxyXG4gICAgICAgICAgICAgICAgICAgIGFqYXhSZXNwb25zZS5yZXNwb25zZSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGZhaWx1cmVDYWxsYmFja0ZvckFzeW5jaHJvbm91c1JlcXVlc3QoYWpheFJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghaXNTeW5jaHJvbm91cykge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tGb3JBc3luY2hyb25vdXNSZXF1ZXN0KGFqYXhSZXNwb25zZSwgaXNGaW5pc2hlZFJlcXVlc3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGFqYXhSZXNwb25zZS5vcGVuKCdHRVQnLCB1cmwsICFpc1N5bmNocm9ub3VzKTtcclxuICAgICAgICBhamF4UmVzcG9uc2Uub25yZWFkeXN0YXRlY2hhbmdlID0gaW50ZXJuYWxBamF4Q2FsbGJhY2s7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFpc1N5bmNocm9ub3VzKSB7XHJcbiAgICAgICAgICAgIC8vIE5vdCBzdXBwb3J0ZWQgZm9yIHN5bmNocm9ub3VzIHJlcXVlc3RzXHJcbiAgICAgICAgICAgIGFqYXhSZXNwb25zZS5tb3pSZXNwb25zZVR5cGUgPSBhamF4UmVzcG9uc2UucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChwcm9ncmVzc2l2ZVJlcXVlc3RRdWFudEJ5dGVzICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgYWpheFJlc3BvbnNlLnNldFJlcXVlc3RIZWFkZXIoJ1gtQ29udGVudC1UeXBlLU9wdGlvbnMnLCAnbm9zbmlmZicpO1xyXG4gICAgICAgICAgICBhamF4UmVzcG9uc2Uub25wcm9ncmVzcyA9IGludGVybmFsQWpheENhbGxiYWNrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBhamF4UmVzcG9uc2Uuc2VuZChudWxsKTtcclxuXHJcbiAgICAgICAgaWYgKGlzU3luY2hyb25vdXMgJiYgIWlzRmluaXNoZWRSZXF1ZXN0KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ3N5bmNocm9ub3VzIGFqYXggY2FsbCB3YXMgbm90IGZpbmlzaGVkIHN5bmNocm9ub3VzbHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGFqYXhSZXNwb25zZTtcclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBNYXJrZXJzUGFyc2VyKFxyXG4gICAgbWFpbkhlYWRlckRhdGFiaW4sIG1lc3NhZ2VIZWFkZXJQYXJzZXIsIGpwaXBGYWN0b3J5KSB7XHJcbiAgICBcclxuICAgIHZhciBDQUNIRV9LRVkgPSAnbWFya2Vycyc7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TWFuZGF0b3J5TWFya2VyT2Zmc2V0SW5EYXRhYmluID1cclxuICAgICAgICBmdW5jdGlvbiBnZXRNYW5kYXRvcnlNYXJrZXJPZmZzZXRJbkRhdGFiaW5DbG9zdXJlKFxyXG4gICAgICAgICAgICBkYXRhYmluLCBtYXJrZXIsIG1hcmtlck5hbWUsIHN0YW5kYXJkU2VjdGlvbikge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBvZmZzZXQgPSBnZXRNYXJrZXJPZmZzZXRJbkRhdGFiaW4oZGF0YWJpbiwgbWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAob2Zmc2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qMmtFeGNlcHRpb25zLklsbGVnYWxEYXRhRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgbWFya2VyTmFtZSArICcgaXMgbm90IGZvdW5kIHdoZXJlIGV4cGVjdGVkIHRvIGJlJyxcclxuICAgICAgICAgICAgICAgIHN0YW5kYXJkU2VjdGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBvZmZzZXQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmNoZWNrU3VwcG9ydGVkTWFya2VycyA9IGZ1bmN0aW9uIGNoZWNrU3VwcG9ydGVkTWFya2Vyc0Nsb3N1cmUoXHJcbiAgICAgICAgZGF0YWJpbiwgbWFya2VycywgaXNNYXJrZXJzU3VwcG9ydGVkKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaXNNYXJrZXJzU3VwcG9ydGVkID0gISFpc01hcmtlcnNTdXBwb3J0ZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGRhdGFiaW5NYXJrZXJzID0gZ2V0RGF0YWJpbk1hcmtlcnMoXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIC8qZm9yY2VBbGxNYXJrZXJzUGFyc2VkPSovdHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1hcmtlcnNBc1Byb3BlcnRpZXMgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcmtlcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIG1hcmtlciA9IGdldE1hcmtlckFzUHJvcGVydHlOYW1lKFxyXG4gICAgICAgICAgICAgICAgbWFya2Vyc1tpXSwgJ2pwaXBNYXJrZXJzUGFyc2VyLnN1cHBvcnRlZE1hcmtlcnNbJyArIGkgKyAnXScpO1xyXG4gICAgICAgICAgICBtYXJrZXJzQXNQcm9wZXJ0aWVzW21hcmtlcl0gPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBleGlzdGluZ01hcmtlciBpbiBkYXRhYmluTWFya2Vycy5tYXJrZXJUb09mZnNldCkge1xyXG4gICAgICAgICAgICB2YXIgaXNNYXJrZXJJbkxpc3QgPSAhIW1hcmtlcnNBc1Byb3BlcnRpZXNbZXhpc3RpbmdNYXJrZXJdO1xyXG4gICAgICAgICAgICBpZiAoaXNNYXJrZXJJbkxpc3QgIT09IGlzTWFya2Vyc1N1cHBvcnRlZCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdVbnN1cHBvcnRlZCBtYXJrZXIgZm91bmQ6ICcgKyBleGlzdGluZ01hcmtlciwgJ3Vua25vd24nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TWFya2VyT2Zmc2V0SW5EYXRhYmluID0gZ2V0TWFya2VyT2Zmc2V0SW5EYXRhYmluO1xyXG4gICAgXHJcbiAgICB0aGlzLmlzTWFya2VyID0gaXNNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGlzTWFya2VyKGRhdGEsIG1hcmtlciwgb2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IChkYXRhW29mZnNldF0gPT09IG1hcmtlclswXSkgJiYgKGRhdGFbb2Zmc2V0ICsgMV0gPT09IG1hcmtlclsxXSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRNYXJrZXJPZmZzZXRJbkRhdGFiaW4oZGF0YWJpbiwgbWFya2VyKSB7XHJcbiAgICAgICAgdmFyIGRhdGFiaW5NYXJrZXJzID0gZ2V0RGF0YWJpbk1hcmtlcnMoXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIC8qZm9yY2VBbGxNYXJrZXJzUGFyc2VkPSovdHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN0ck1hcmtlciA9IGdldE1hcmtlckFzUHJvcGVydHlOYW1lKFxyXG4gICAgICAgICAgICBtYXJrZXIsICdQcmVkZWZpbmVkIG1hcmtlciBpbiBqR2xvYmFscy5qMmtNYXJrZXJzJyk7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IGRhdGFiaW5NYXJrZXJzLm1hcmtlclRvT2Zmc2V0W3N0ck1hcmtlcl07XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldERhdGFiaW5NYXJrZXJzKGRhdGFiaW4sIGZvcmNlQWxsTWFya2Vyc1BhcnNlZCkge1xyXG4gICAgICAgIHZhciBkYXRhYmluTWFya2VycyA9IGRhdGFiaW4uZ2V0Q2FjaGVkRGF0YShDQUNIRV9LRVkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChkYXRhYmluTWFya2Vycy5tYXJrZXJUb09mZnNldCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLmlzUGFyc2VkQWxsTWFya2VycyA9IGZhbHNlO1xyXG4gICAgICAgICAgICBkYXRhYmluTWFya2Vycy5sYXN0T2Zmc2V0UGFyc2VkID0gMDtcclxuICAgICAgICAgICAgZGF0YWJpbk1hcmtlcnMubWFya2VyVG9PZmZzZXQgPSB7fTtcclxuICAgICAgICAgICAgZGF0YWJpbk1hcmtlcnMuZGF0YWJpbiA9IGRhdGFiaW47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChkYXRhYmluTWFya2Vycy5pc1BhcnNlZEFsbE1hcmtlcnMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRhdGFiaW5NYXJrZXJzO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3RhcnRPZmZzZXQgPSAwO1xyXG4gICAgICAgIHZhciBieXRlcyA9IFtdO1xyXG4gICAgICAgIHZhciBjYW5QYXJzZSA9IHRydWU7XHJcblxyXG4gICAgICAgIGlmIChkYXRhYmluID09PSBtYWluSGVhZGVyRGF0YWJpbiAmJiBkYXRhYmluTWFya2Vycy5sYXN0T2Zmc2V0UGFyc2VkID09PSAwKSB7XHJcbiAgICAgICAgICAgIHZhciBieXRlc0NvcGllZCA9IGRhdGFiaW4uY29weUJ5dGVzKGJ5dGVzLCAvKnN0YXJ0T2Zmc2V0PSovMCwge1xyXG4gICAgICAgICAgICAgICAgZm9yY2VDb3B5QWxsUmFuZ2U6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtYXhMZW5ndGhUb0NvcHk6IGpHbG9iYWxzLmoya09mZnNldHMuTUFSS0VSX1NJWkVcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJ5dGVzQ29waWVkID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBjYW5QYXJzZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFpc01hcmtlcihieXRlcywgakdsb2JhbHMuajJrTWFya2Vycy5TdGFydE9mQ29kZXN0cmVhbSwgLypvZmZzZXQ9Ki8wKSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1NPQyAoU3RhcnQgT2YgQ29kZXN0cmVhbSkgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgJ2lzIG5vdCBmb3VuZCB3aGVyZSBleHBlY3RlZCB0byBiZScsXHJcbiAgICAgICAgICAgICAgICAgICAgJ0EuNC4xJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLmxhc3RPZmZzZXRQYXJzZWQgPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNhblBhcnNlKSB7XHJcbiAgICAgICAgICAgIGFjdHVhbFBhcnNlTWFya2VycyhkYXRhYmluTWFya2Vycyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGFmdGVyUGFyc2VNYXJrZXJzKGRhdGFiaW5NYXJrZXJzLCBmb3JjZUFsbE1hcmtlcnNQYXJzZWQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBkYXRhYmluTWFya2VycztcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWN0dWFsUGFyc2VNYXJrZXJzKGRhdGFiaW5NYXJrZXJzKSB7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IGRhdGFiaW5NYXJrZXJzLmxhc3RPZmZzZXRQYXJzZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGJ5dGVzID0gW107XHJcbiAgICAgICAgdmFyIGJ5dGVzQ29waWVkID0gZGF0YWJpbk1hcmtlcnMuZGF0YWJpbi5jb3B5Qnl0ZXMoYnl0ZXMsIC8qc3RhcnRPZmZzZXQ9Ki8wLCB7XHJcbiAgICAgICAgICAgICAgICBmb3JjZUNvcHlBbGxSYW5nZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1heExlbmd0aFRvQ29weTogakdsb2JhbHMuajJrT2Zmc2V0cy5NQVJLRVJfU0laRSArIGpHbG9iYWxzLmoya09mZnNldHMuTEVOR1RIX0ZJRUxEX1NJWkUsXHJcbiAgICAgICAgICAgICAgICBkYXRhYmluU3RhcnRPZmZzZXQ6IG9mZnNldFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKGJ5dGVzQ29waWVkICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciBtYXJrZXIgPSBnZXRNYXJrZXJBc1Byb3BlcnR5TmFtZShcclxuICAgICAgICAgICAgICAgIGJ5dGVzLFxyXG4gICAgICAgICAgICAgICAgJ29mZnNldCAnICsgb2Zmc2V0ICsgJyBvZiBkYXRhYmluIHdpdGggY2xhc3MgSUQgPSAnICtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhYmluTWFya2Vycy5kYXRhYmluLmdldENsYXNzSWQoKSArICcgYW5kIGluIGNsYXNzIElEID0gJyArXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YWJpbk1hcmtlcnMuZGF0YWJpbi5nZXRJbkNsYXNzSWQoKSk7XHJcbiAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLm1hcmtlclRvT2Zmc2V0W21hcmtlci50b1N0cmluZygpXSA9IG9mZnNldDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbGVuZ3RoID0gbWVzc2FnZUhlYWRlclBhcnNlci5nZXRJbnQxNihieXRlcywgakdsb2JhbHMuajJrT2Zmc2V0cy5NQVJLRVJfU0laRSk7XHJcbiAgICAgICAgICAgIG9mZnNldCArPSBsZW5ndGggKyBqR2xvYmFscy5qMmtPZmZzZXRzLk1BUktFUl9TSVpFO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgYnl0ZXNDb3BpZWQgPSBkYXRhYmluTWFya2Vycy5kYXRhYmluLmNvcHlCeXRlcyhieXRlcywgLypzdGFydE9mZnNldD0qLzAsIHtcclxuICAgICAgICAgICAgICAgIGZvcmNlQ29weUFsbFJhbmdlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWF4TGVuZ3RoVG9Db3B5OiBqR2xvYmFscy5qMmtPZmZzZXRzLk1BUktFUl9TSVpFICsgakdsb2JhbHMuajJrT2Zmc2V0cy5MRU5HVEhfRklFTERfU0laRSxcclxuICAgICAgICAgICAgICAgIGRhdGFiaW5TdGFydE9mZnNldDogb2Zmc2V0XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRhdGFiaW5NYXJrZXJzLmxhc3RPZmZzZXRQYXJzZWQgPSBvZmZzZXQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFmdGVyUGFyc2VNYXJrZXJzKGRhdGFiaW5NYXJrZXJzLCBmb3JjZUFsbE1hcmtlcnNQYXJzZWQpIHtcclxuICAgICAgICB2YXIgZGF0YWJpbkxlbmd0aCA9IGRhdGFiaW5NYXJrZXJzLmRhdGFiaW4uZ2V0RGF0YWJpbkxlbmd0aElmS25vd24oKTtcclxuICAgICAgICBkYXRhYmluTWFya2Vycy5pc1BhcnNlZEFsbE1hcmtlcnMgPSBkYXRhYmluTWFya2Vycy5sYXN0T2Zmc2V0UGFyc2VkID09PSBkYXRhYmluTGVuZ3RoO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghZGF0YWJpbk1hcmtlcnMuaXNQYXJzZWRBbGxNYXJrZXJzICYmIGRhdGFiaW5NYXJrZXJzLmRhdGFiaW4gIT09IG1haW5IZWFkZXJEYXRhYmluKSB7XHJcbiAgICAgICAgICAgIHZhciBieXRlcyA9IFtdO1xyXG4gICAgICAgICAgICB2YXIgYnl0ZXNDb3BpZWQgPSBkYXRhYmluTWFya2Vycy5kYXRhYmluLmNvcHlCeXRlcyhieXRlcywgLypzdGFydE9mZnNldD0qLzAsIHtcclxuICAgICAgICAgICAgICAgIGZvcmNlQ29weUFsbFJhbmdlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWF4TGVuZ3RoVG9Db3B5OiBqR2xvYmFscy5qMmtPZmZzZXRzLk1BUktFUl9TSVpFLFxyXG4gICAgICAgICAgICAgICAgZGF0YWJpblN0YXJ0T2Zmc2V0OiBkYXRhYmluTWFya2Vycy5sYXN0T2Zmc2V0UGFyc2VkXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChieXRlc0NvcGllZCAhPT0gbnVsbCAmJlxyXG4gICAgICAgICAgICAgICAgaXNNYXJrZXIoYnl0ZXMsIDAsIGpHbG9iYWxzLmoya01hcmtlcnMuU3RhcnRPZkRhdGEpKSB7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLmxhc3RPZmZzZXRQYXJzZWQgKz0gakdsb2JhbHMuajJrT2Zmc2V0cy5NQVJLRVJfU0laRTtcclxuICAgICAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLmlzUGFyc2VkQWxsTWFya2VycyA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGZvcmNlQWxsTWFya2Vyc1BhcnNlZCAmJiAhZGF0YWJpbk1hcmtlcnMuaXNQYXJzZWRBbGxNYXJrZXJzKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ2RhdGEtYmluIHdpdGggY2xhc3MgSUQgPSAnICtcclxuICAgICAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLmRhdGFiaW4uZ2V0Q2xhc3NJZCgpICsgJyBhbmQgaW4gY2xhc3MgSUQgPSAnICtcclxuICAgICAgICAgICAgICAgIGRhdGFiaW5NYXJrZXJzLmRhdGFiaW4uZ2V0SW5DbGFzc0lkKCkgK1xyXG4gICAgICAgICAgICAgICAgJyB3YXMgbm90IHJlY2lldmVkIHlldCcpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0TWFya2VyQXNQcm9wZXJ0eU5hbWUoYnl0ZXMsIG1hcmtlclBvc2l0aW9uRGVzY3JpcHRpb24pIHtcclxuICAgICAgICBpZiAoYnl0ZXNbMF0gIT09IDB4RkYpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnRXhwZWN0ZWQgbWFya2VyIGluICcgKyBtYXJrZXJQb3NpdGlvbkRlc2NyaXB0aW9uLCAnQScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgbWFya2VyID0gYnl0ZXNbMV0udG9TdHJpbmcoMTYpO1xyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwT2Zmc2V0c0NhbGN1bGF0b3IoXHJcbiAgICBtYWluSGVhZGVyRGF0YWJpbiwgbWFya2Vyc1BhcnNlcikge1xyXG4gICAgXHJcbiAgICB2YXIgc3VwcG9ydGVkTWFya2VycyA9IFtcclxuICAgICAgICBqR2xvYmFscy5qMmtNYXJrZXJzLkltYWdlQW5kVGlsZVNpemUsXHJcbiAgICAgICAgakdsb2JhbHMuajJrTWFya2Vycy5Db2RpbmdTdHlsZURlZmF1bHQsXHJcbiAgICAgICAgakdsb2JhbHMuajJrTWFya2Vycy5RdWFudGl6YXRpb25EZWZhdWx0LFxyXG4gICAgICAgIGpHbG9iYWxzLmoya01hcmtlcnMuQ29tbWVudFxyXG4gICAgICAgIF07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Q29kaW5nU3R5bGVPZmZzZXQgPSBnZXRDb2RpbmdTdHlsZU9mZnNldDtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRDb2RpbmdTdHlsZUJhc2VQYXJhbXMgPSBnZXRDb2RpbmdTdHlsZUJhc2VQYXJhbXM7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0SW1hZ2VBbmRUaWxlU2l6ZU9mZnNldCA9IGZ1bmN0aW9uIGdldEltYWdlQW5kVGlsZVNpemVPZmZzZXQoKSB7XHJcbiAgICAgICAgLy8gQS41LjEgKEltYWdlIGFuZCB0aWxlIHNpemUgbWFya2VyIHNlZ21lbnQpXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNpek1hcmtlck9mZnNldCA9IG1hcmtlcnNQYXJzZXIuZ2V0TWFuZGF0b3J5TWFya2VyT2Zmc2V0SW5EYXRhYmluKFxyXG4gICAgICAgICAgICBtYWluSGVhZGVyRGF0YWJpbixcclxuICAgICAgICAgICAgakdsb2JhbHMuajJrTWFya2Vycy5JbWFnZUFuZFRpbGVTaXplLFxyXG4gICAgICAgICAgICAnSW1hZ2UgYW5kIFRpbGUgU2l6ZSAoU0laKScsXHJcbiAgICAgICAgICAgICdBLjUuMScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBzaXpNYXJrZXJPZmZzZXQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFJhbmdlc09mQmVzdFJlc29sdXRpb25MZXZlbHNEYXRhID1cclxuICAgICAgICBmdW5jdGlvbiBnZXRSYW5nZXNXaXRoRGF0YU9mUmVzb2x1dGlvbkxldmVsc0Nsb3N1cmUoXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIG51bVJlc29sdXRpb25MZXZlbHMpIHtcclxuICAgICAgICBcclxuICAgICAgICBtYXJrZXJzUGFyc2VyLmNoZWNrU3VwcG9ydGVkTWFya2VycyhcclxuICAgICAgICAgICAgZGF0YWJpbiwgc3VwcG9ydGVkTWFya2VycywgLyppc01hcmtlcnNTdXBwb3J0ZWQ9Ki90cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtRGVjb21wb3NpdGlvbkxldmVsc09mZnNldCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGRhdGFiaW5Db2RpbmdTdHlsZURlZmF1bHRCYXNlUGFyYW1zID0gZ2V0Q29kaW5nU3R5bGVCYXNlUGFyYW1zKFxyXG4gICAgICAgICAgICBkYXRhYmluLCAvKmlzTWFuZGF0b3J5PSovZmFsc2UpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBkYXRhYmluT3JNYWluSGVhZGVyQ29kaW5nU3R5bGVCYXNlUGFyYW1zID0gZGF0YWJpbkNvZGluZ1N0eWxlRGVmYXVsdEJhc2VQYXJhbXM7XHJcbiAgICAgICAgaWYgKGRhdGFiaW5Db2RpbmdTdHlsZURlZmF1bHRCYXNlUGFyYW1zID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGRhdGFiaW5Pck1haW5IZWFkZXJDb2RpbmdTdHlsZUJhc2VQYXJhbXMgPSBnZXRDb2RpbmdTdHlsZUJhc2VQYXJhbXMoXHJcbiAgICAgICAgICAgICAgICBtYWluSGVhZGVyRGF0YWJpbiwgLyppc01hbmRhdG9yeT0qL3RydWUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG51bURlY29tcG9zaXRpb25MZXZlbHNPZmZzZXQgPVxyXG4gICAgICAgICAgICAgICAgZGF0YWJpbkNvZGluZ1N0eWxlRGVmYXVsdEJhc2VQYXJhbXMubnVtRGVjb21wb3NpdGlvbkxldmVsc09mZnNldDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvZGluZ1N0eWxlTnVtUmVzb2x1dGlvbkxldmVscyA9IFxyXG4gICAgICAgICAgICBkYXRhYmluT3JNYWluSGVhZGVyQ29kaW5nU3R5bGVCYXNlUGFyYW1zLm51bVJlc29sdXRpb25MZXZlbHM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGlmIChjb2RpbmdTdHlsZU51bVJlc29sdXRpb25MZXZlbHMgPD0gbnVtUmVzb2x1dGlvbkxldmVscykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdudW1SZXNvbHV0aW9uTGV2ZWxzICgnICsgbnVtUmVzb2x1dGlvbkxldmVscyArICcpIDw9IENPRC4nICtcclxuICAgICAgICAgICAgICAgICdudW1SZXNvbHV0aW9uTGV2ZWxzICgnICsgY29kaW5nU3R5bGVOdW1SZXNvbHV0aW9uTGV2ZWxzICsgJyknKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciByYW5nZXMgPSBbXTtcclxuXHJcbiAgICAgICAgYWRkUmFuZ2VPZkJlc3RSZXNvbHV0aW9uTGV2ZWxzSW5Db2RpbmdTdHlsZShcclxuICAgICAgICAgICAgcmFuZ2VzLCBkYXRhYmluQ29kaW5nU3R5bGVEZWZhdWx0QmFzZVBhcmFtcywgbnVtUmVzb2x1dGlvbkxldmVscyk7XHJcblxyXG4gICAgICAgIGFkZFJhbmdlT2ZCZXN0UmVzb2x1dGlvbkxldmVsc0luUXVhbnRpemF0aW9uKFxyXG4gICAgICAgICAgICByYW5nZXMsXHJcbiAgICAgICAgICAgIGRhdGFiaW4sXHJcbiAgICAgICAgICAgIGRhdGFiaW5Pck1haW5IZWFkZXJDb2RpbmdTdHlsZUJhc2VQYXJhbXMsXHJcbiAgICAgICAgICAgIG51bVJlc29sdXRpb25MZXZlbHMpO1xyXG5cclxuICAgICAgICB2YXIgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICByYW5nZXM6IHJhbmdlcyxcclxuICAgICAgICAgICAgbnVtRGVjb21wb3NpdGlvbkxldmVsc09mZnNldDogbnVtRGVjb21wb3NpdGlvbkxldmVsc09mZnNldFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRDb2RpbmdTdHlsZUJhc2VQYXJhbXMoXHJcbiAgICAgICAgZGF0YWJpbiwgaXNNYW5kYXRvcnkpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29kaW5nU3R5bGVEZWZhdWx0T2Zmc2V0ID0gZ2V0Q29kaW5nU3R5bGVPZmZzZXQoXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIGlzTWFuZGF0b3J5KTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoY29kaW5nU3R5bGVEZWZhdWx0T2Zmc2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtQnl0ZXMgPSA4O1xyXG4gICAgICAgIHZhciBieXRlc09mZnNldCA9IGNvZGluZ1N0eWxlRGVmYXVsdE9mZnNldCArIGpHbG9iYWxzLmoya09mZnNldHMuTUFSS0VSX1NJWkU7XHJcbiAgICAgICAgdmFyIGJ5dGVzID0gZ2V0Qnl0ZXMoZGF0YWJpbiwgbnVtQnl0ZXMsIGJ5dGVzT2Zmc2V0KTtcclxuXHJcbiAgICAgICAgdmFyIGNvZGluZ1N0eWxlRmxhZ3NGb3JBbGxDb21wb25lbnRzT2Zmc2V0ID0gMjsgLy8gU2NvZFxyXG4gICAgICAgIHZhciBjb2RpbmdTdHlsZUZsYWdzRm9yQWxsQ29tcG9uZW50cyA9XHJcbiAgICAgICAgICAgIGJ5dGVzW2NvZGluZ1N0eWxlRmxhZ3NGb3JBbGxDb21wb25lbnRzT2Zmc2V0XTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdmFyIGlzRGVmYXVsdFByZWNpbmN0U2l6ZSA9ICEoY29kaW5nU3R5bGVGbGFnc0ZvckFsbENvbXBvbmVudHMgJiAweDEpO1xyXG4gICAgICAgIHZhciBpc1N0YXJ0T2ZQYWNrZXRNYXJrZXJBbGxvd2VkID0gISEoY29kaW5nU3R5bGVGbGFnc0ZvckFsbENvbXBvbmVudHMgJiAweDIpO1xyXG4gICAgICAgIHZhciBpc0VuZFBhY2tldEhlYWRlck1hcmtlckFsbG93ZWQgPSAhIShjb2RpbmdTdHlsZUZsYWdzRm9yQWxsQ29tcG9uZW50cyAmIDB4NCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG51bURlY29tcG9zaXRpb25MZXZlbHNPZmZzZXRJbkJ5dGVzID0gNzsgLy8gU1Bjb2QsIDFzdCBieXRlXHJcbiAgICAgICAgdmFyIG51bURlY29tcG9zaXRpb25MZXZlbHMgPSBieXRlc1tudW1EZWNvbXBvc2l0aW9uTGV2ZWxzT2Zmc2V0SW5CeXRlc107XHJcbiAgICAgICAgdmFyIG51bVJlc29sdXRpb25MZXZlbHMgPSBudW1EZWNvbXBvc2l0aW9uTGV2ZWxzICsgMTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtRGVjb21wb3NpdGlvbkxldmVsc09mZnNldCA9IGJ5dGVzT2Zmc2V0ICsgbnVtRGVjb21wb3NpdGlvbkxldmVsc09mZnNldEluQnl0ZXM7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHByZWNpbmN0U2l6ZXNPZmZzZXQgPSBpc0RlZmF1bHRQcmVjaW5jdFNpemUgPyBudWxsIDogY29kaW5nU3R5bGVEZWZhdWx0T2Zmc2V0ICsgMTQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgY29kaW5nU3R5bGVEZWZhdWx0T2Zmc2V0OiBjb2RpbmdTdHlsZURlZmF1bHRPZmZzZXQsXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpc0RlZmF1bHRQcmVjaW5jdFNpemU6IGlzRGVmYXVsdFByZWNpbmN0U2l6ZSxcclxuICAgICAgICAgICAgaXNTdGFydE9mUGFja2V0TWFya2VyQWxsb3dlZDogaXNTdGFydE9mUGFja2V0TWFya2VyQWxsb3dlZCxcclxuICAgICAgICAgICAgaXNFbmRQYWNrZXRIZWFkZXJNYXJrZXJBbGxvd2VkOiBpc0VuZFBhY2tldEhlYWRlck1hcmtlckFsbG93ZWQsXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBudW1SZXNvbHV0aW9uTGV2ZWxzOiBudW1SZXNvbHV0aW9uTGV2ZWxzLFxyXG4gICAgICAgICAgICBwcmVjaW5jdFNpemVzT2Zmc2V0OiBwcmVjaW5jdFNpemVzT2Zmc2V0LFxyXG4gICAgICAgICAgICBudW1EZWNvbXBvc2l0aW9uTGV2ZWxzT2Zmc2V0OiBudW1EZWNvbXBvc2l0aW9uTGV2ZWxzT2Zmc2V0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkUmFuZ2VPZkJlc3RSZXNvbHV0aW9uTGV2ZWxzSW5Db2RpbmdTdHlsZShcclxuICAgICAgICByYW5nZXMsIGNvZGluZ1N0eWxlRGVmYXVsdEJhc2VQYXJhbXMsIG51bVJlc29sdXRpb25MZXZlbHMpIHtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoY29kaW5nU3R5bGVEZWZhdWx0QmFzZVBhcmFtcyA9PT0gbnVsbCB8fFxyXG4gICAgICAgICAgICBjb2RpbmdTdHlsZURlZmF1bHRCYXNlUGFyYW1zLmlzRGVmYXVsdFByZWNpbmN0U2l6ZSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgbGV2ZWxzTm90SW5SYW5nZSA9XHJcbiAgICAgICAgICAgIGNvZGluZ1N0eWxlRGVmYXVsdEJhc2VQYXJhbXMubnVtUmVzb2x1dGlvbkxldmVscyAtIG51bVJlc29sdXRpb25MZXZlbHM7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZpcnN0T2Zmc2V0SW5SYW5nZSA9XHJcbiAgICAgICAgICAgIGNvZGluZ1N0eWxlRGVmYXVsdEJhc2VQYXJhbXMucHJlY2luY3RTaXplc09mZnNldCArIGxldmVsc05vdEluUmFuZ2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1hcmtlckxlbmd0aE9mZnNldCA9IFxyXG4gICAgICAgICAgICBjb2RpbmdTdHlsZURlZmF1bHRCYXNlUGFyYW1zLmNvZGluZ1N0eWxlRGVmYXVsdE9mZnNldCArIGpHbG9iYWxzLmoya09mZnNldHMuTUFSS0VSX1NJWkU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHByZWNpbmN0U2l6ZXNSYW5nZSA9IHtcclxuICAgICAgICAgICAgbWFya2VyU2VnbWVudExlbmd0aE9mZnNldDogbWFya2VyTGVuZ3RoT2Zmc2V0LFxyXG4gICAgICAgICAgICBzdGFydDogZmlyc3RPZmZzZXRJblJhbmdlLFxyXG4gICAgICAgICAgICBsZW5ndGg6IG51bVJlc29sdXRpb25MZXZlbHNcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuXHJcbiAgICAgICAgcmFuZ2VzLnB1c2gocHJlY2luY3RTaXplc1JhbmdlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRRdWFudGl6YXRpb25EYXRhQnl0ZXNQZXJTdWJiYW5kKGRhdGFiaW4sIHF1YW50aXphdGlvblN0eWxlT2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIHNxY2RPZmZzZXQgPSBxdWFudGl6YXRpb25TdHlsZU9mZnNldCArIDQ7IC8vIFNxY2RcclxuICAgICAgICB2YXIgYnl0ZXMgPSBnZXRCeXRlcyhkYXRhYmluLCAvKm51bUJ5dGVzPSovMSwgc3FjZE9mZnNldCk7XHJcbiAgICAgICAgdmFyIHF1YW50aXphdGlvblN0eWxlID0gYnl0ZXNbMF0gJiAweDFGO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBieXRlc1BlclN1YmJhbmQ7XHJcbiAgICAgICAgc3dpdGNoIChxdWFudGl6YXRpb25TdHlsZSkge1xyXG4gICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICBieXRlc1BlclN1YmJhbmQgPSAxO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgIGJ5dGVzUGVyU3ViYmFuZCA9IDA7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICAgICAgYnl0ZXNQZXJTdWJiYW5kID0gMjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1F1YW50aXphdGlvbiBzdHlsZSBvZiAnICsgcXVhbnRpemF0aW9uU3R5bGUsICdBLjYuNCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gYnl0ZXNQZXJTdWJiYW5kO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBhZGRSYW5nZU9mQmVzdFJlc29sdXRpb25MZXZlbHNJblF1YW50aXphdGlvbihcclxuICAgICAgICByYW5nZXMsXHJcbiAgICAgICAgZGF0YWJpbixcclxuICAgICAgICBjb2RpbmdTdHlsZURlZmF1bHRCYXNlUGFyYW1zLFxyXG4gICAgICAgIG51bVJlc29sdXRpb25MZXZlbHMpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcWNkTWFya2VyT2Zmc2V0ID0gbWFya2Vyc1BhcnNlci5nZXRNYXJrZXJPZmZzZXRJbkRhdGFiaW4oXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIGpHbG9iYWxzLmoya01hcmtlcnMuUXVhbnRpemF0aW9uRGVmYXVsdCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHFjZE1hcmtlck9mZnNldCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBieXRlc1BlclN1YmJhbmQgPSBnZXRRdWFudGl6YXRpb25EYXRhQnl0ZXNQZXJTdWJiYW5kKFxyXG4gICAgICAgICAgICBkYXRhYmluLCBxY2RNYXJrZXJPZmZzZXQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBpZiAoYnl0ZXNQZXJTdWJiYW5kID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxldmVsc05vdEluUmFuZ2UgPVxyXG4gICAgICAgICAgICBjb2RpbmdTdHlsZURlZmF1bHRCYXNlUGFyYW1zLm51bVJlc29sdXRpb25MZXZlbHMgLSBudW1SZXNvbHV0aW9uTGV2ZWxzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzdWJiYW5kc05vdEluUmFuZ2UgPSAxICsgMyAqIChsZXZlbHNOb3RJblJhbmdlIC0gMSk7XHJcbiAgICAgICAgdmFyIHN1YmJhbmRzSW5SYW5nZSA9IDMgKiBudW1SZXNvbHV0aW9uTGV2ZWxzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBmaXJzdE9mZnNldEluUmFuZ2UgPVxyXG4gICAgICAgICAgICBxY2RNYXJrZXJPZmZzZXQgKyA1ICsgc3ViYmFuZHNOb3RJblJhbmdlICogYnl0ZXNQZXJTdWJiYW5kO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByYW5nZUxlbmd0aCA9IHN1YmJhbmRzSW5SYW5nZSAqIGJ5dGVzUGVyU3ViYmFuZDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbWFya2VyTGVuZ3RoT2Zmc2V0ID0gcWNkTWFya2VyT2Zmc2V0ICsgakdsb2JhbHMuajJrT2Zmc2V0cy5NQVJLRVJfU0laRTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcXVhbnRpemF0aW9uc1JhbmdlID0ge1xyXG4gICAgICAgICAgICBtYXJrZXJTZWdtZW50TGVuZ3RoT2Zmc2V0OiBtYXJrZXJMZW5ndGhPZmZzZXQsXHJcbiAgICAgICAgICAgIHN0YXJ0OiBmaXJzdE9mZnNldEluUmFuZ2UsXHJcbiAgICAgICAgICAgIGxlbmd0aDogcmFuZ2VMZW5ndGhcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICByYW5nZXMucHVzaChxdWFudGl6YXRpb25zUmFuZ2UpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBleHBlY3ROb0NvZGluZ1N0eWxlQ29tcG9uZW50KGRhdGFiaW4pIHtcclxuICAgICAgICB2YXIgY29jT2Zmc2V0ID0gbWFya2Vyc1BhcnNlci5nZXRNYXJrZXJPZmZzZXRJbkRhdGFiaW4oXHJcbiAgICAgICAgICAgIGRhdGFiaW4sIGpHbG9iYWxzLmoya01hcmtlcnMuQ29kaW5nU3R5bGVDb21wb25lbnQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjb2NPZmZzZXQgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgLy8gQS42LjJcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ0NPQyBNYXJrZXIgKENvZGluZyBTdHlsZSBDb21wb25lbnQpJywgJ0EuNi4yJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRDb2RpbmdTdHlsZU9mZnNldChkYXRhYmluLCBpc01hbmRhdG9yeSkge1xyXG4gICAgICAgIGV4cGVjdE5vQ29kaW5nU3R5bGVDb21wb25lbnQoZGF0YWJpbik7XHJcblxyXG4gICAgICAgIHZhciBvZmZzZXQ7XHJcbiAgICAgICAgaWYgKGlzTWFuZGF0b3J5KSB7XHJcbiAgICAgICAgICAgIG9mZnNldCA9IG1hcmtlcnNQYXJzZXIuZ2V0TWFuZGF0b3J5TWFya2VyT2Zmc2V0SW5EYXRhYmluKFxyXG4gICAgICAgICAgICAgICAgZGF0YWJpbixcclxuICAgICAgICAgICAgICAgIGpHbG9iYWxzLmoya01hcmtlcnMuQ29kaW5nU3R5bGVEZWZhdWx0LFxyXG4gICAgICAgICAgICAgICAgJ0NPRCAoQ29kaW5nIHN0eWxlIERlZmF1bHQpJyxcclxuICAgICAgICAgICAgICAgICdBLjYuMScpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG9mZnNldCA9IG1hcmtlcnNQYXJzZXIuZ2V0TWFya2VyT2Zmc2V0SW5EYXRhYmluKFxyXG4gICAgICAgICAgICAgICAgZGF0YWJpbiwgakdsb2JhbHMuajJrTWFya2Vycy5Db2RpbmdTdHlsZURlZmF1bHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRCeXRlcyhkYXRhYmluLCBudW1CeXRlcywgZGF0YWJpblN0YXJ0T2Zmc2V0LCBhbGxvd0VuZE9mUmFuZ2UpIHtcclxuICAgICAgICB2YXIgYnl0ZXMgPSBbXTtcclxuXHJcbiAgICAgICAgdmFyIHJhbmdlT3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgZm9yY2VDb3B5QWxsUmFuZ2U6IHRydWUsXHJcbiAgICAgICAgICAgIG1heExlbmd0aFRvQ29weTogbnVtQnl0ZXMsXHJcbiAgICAgICAgICAgIGRhdGFiaW5TdGFydE9mZnNldDogZGF0YWJpblN0YXJ0T2Zmc2V0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGJ5dGVzQ29waWVkID0gZGF0YWJpbi5jb3B5Qnl0ZXMoYnl0ZXMsIC8qc3RhcnRPZmZzZXQ9Ki8wLCByYW5nZU9wdGlvbnMpO1xyXG4gICAgICAgIGlmIChieXRlc0NvcGllZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdIZWFkZXIgZGF0YS1iaW4gaGFzIG5vdCB5ZXQgcmVjaWV2ZWQgJyArIG51bUJ5dGVzICtcclxuICAgICAgICAgICAgICAgICcgYnl0ZXMgc3RhcnRpbmcgZnJvbSBvZmZzZXQgJyArIGRhdGFiaW5TdGFydE9mZnNldCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBieXRlcztcclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBTdHJ1Y3R1cmVQYXJzZXIoXHJcbiAgICBkYXRhYmluc1NhdmVyLCBtYXJrZXJzUGFyc2VyLCBtZXNzYWdlSGVhZGVyUGFyc2VyLCBvZmZzZXRzQ2FsY3VsYXRvcikge1xyXG4gICAgXHJcbiAgICB0aGlzLnBhcnNlQ29kZXN0cmVhbVN0cnVjdHVyZSA9IGZ1bmN0aW9uIHBhcnNlQ29kZXN0cmVhbVN0cnVjdHVyZSgpIHtcclxuICAgICAgICAvLyBBLjUuMSAoSW1hZ2UgYW5kIFRpbGUgU2l6ZSlcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbWFpbkhlYWRlckRhdGFiaW4gPSBkYXRhYmluc1NhdmVyLmdldE1haW5IZWFkZXJEYXRhYmluKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNpek1hcmtlck9mZnNldCA9IG9mZnNldHNDYWxjdWxhdG9yLmdldEltYWdlQW5kVGlsZVNpemVPZmZzZXQoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXMgPSBnZXRCeXRlcyhcclxuICAgICAgICAgICAgbWFpbkhlYWRlckRhdGFiaW4sXHJcbiAgICAgICAgICAgIC8qbnVtQnl0ZXM9Ki8zOCxcclxuICAgICAgICAgICAgc2l6TWFya2VyT2Zmc2V0ICsgakdsb2JhbHMuajJrT2Zmc2V0cy5NQVJLRVJfU0laRSArIGpHbG9iYWxzLmoya09mZnNldHMuTEVOR1RIX0ZJRUxEX1NJWkUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByZWZlcmVuY2VHcmlkU2l6ZU9mZnNldCA9XHJcbiAgICAgICAgICAgIGpHbG9iYWxzLmoya09mZnNldHMuUkVGRVJFTkNFX0dSSURfU0laRV9PRkZTRVRfQUZURVJfU0laX01BUktFUiAtXHJcbiAgICAgICAgICAgIChqR2xvYmFscy5qMmtPZmZzZXRzLk1BUktFUl9TSVpFICsgakdsb2JhbHMuajJrT2Zmc2V0cy5MRU5HVEhfRklFTERfU0laRSk7XHJcbiAgICAgICAgdmFyIG51bUNvbXBvbmVudHNPZmZzZXQgPVxyXG4gICAgICAgICAgICBqR2xvYmFscy5qMmtPZmZzZXRzLk5VTV9DT01QT05FTlRTX09GRlNFVF9BRlRFUl9TSVpfTUFSS0VSIC1cclxuICAgICAgICAgICAgKGpHbG9iYWxzLmoya09mZnNldHMuTUFSS0VSX1NJWkUgKyBqR2xvYmFscy5qMmtPZmZzZXRzLkxFTkdUSF9GSUVMRF9TSVpFKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlZmVyZW5jZUdyaWRTaXplWCA9IG1lc3NhZ2VIZWFkZXJQYXJzZXIuZ2V0SW50MzIoXHJcbiAgICAgICAgICAgIGJ5dGVzLCByZWZlcmVuY2VHcmlkU2l6ZU9mZnNldCk7IC8vIFhTaXpcclxuICAgICAgICB2YXIgcmVmZXJlbmNlR3JpZFNpemVZID0gbWVzc2FnZUhlYWRlclBhcnNlci5nZXRJbnQzMihcclxuICAgICAgICAgICAgYnl0ZXMsIHJlZmVyZW5jZUdyaWRTaXplT2Zmc2V0ICsgNCk7IC8vIFlTaXpcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdmFyIGltYWdlT2Zmc2V0WCA9IG1lc3NhZ2VIZWFkZXJQYXJzZXIuZ2V0SW50MzIoYnl0ZXMsIDEwKTsgLy8gWE9TaXpcclxuICAgICAgICB2YXIgaW1hZ2VPZmZzZXRZID0gbWVzc2FnZUhlYWRlclBhcnNlci5nZXRJbnQzMihieXRlcywgMTQpOyAvLyBZT1NpelxyXG4gICAgICAgIHZhciB0aWxlU2l6ZVggPSBtZXNzYWdlSGVhZGVyUGFyc2VyLmdldEludDMyKGJ5dGVzLCAxOCk7IC8vIFhUU2l6XHJcbiAgICAgICAgdmFyIHRpbGVTaXplWSA9IG1lc3NhZ2VIZWFkZXJQYXJzZXIuZ2V0SW50MzIoYnl0ZXMsIDIyKTsgLy8gWVRTaXpcclxuICAgICAgICB2YXIgZmlyc3RUaWxlT2Zmc2V0WCA9IG1lc3NhZ2VIZWFkZXJQYXJzZXIuZ2V0SW50MzIoYnl0ZXMsIDI2KTsgLy8gWFRPU2l6XHJcbiAgICAgICAgdmFyIGZpcnN0VGlsZU9mZnNldFkgPSBtZXNzYWdlSGVhZGVyUGFyc2VyLmdldEludDMyKGJ5dGVzLCAzMCk7IC8vIFlUT1NpelxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBudW1Db21wb25lbnRzID0gbWVzc2FnZUhlYWRlclBhcnNlci5nZXRJbnQxNihieXRlcywgbnVtQ29tcG9uZW50c09mZnNldCk7IC8vIENTaXpcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29tcG9uZW50c0RhdGFPZmZzZXQgPVxyXG4gICAgICAgICAgICBzaXpNYXJrZXJPZmZzZXQgKyBqR2xvYmFscy5qMmtPZmZzZXRzLk5VTV9DT01QT05FTlRTX09GRlNFVF9BRlRFUl9TSVpfTUFSS0VSICsgMjtcclxuICAgICAgICB2YXIgY29tcG9uZW50c0RhdGFMZW5ndGggPSBudW1Db21wb25lbnRzICogMztcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29tcG9uZW50c0RhdGFCeXRlcyA9IGdldEJ5dGVzKFxyXG4gICAgICAgICAgICBtYWluSGVhZGVyRGF0YWJpbiwgY29tcG9uZW50c0RhdGFMZW5ndGgsIGNvbXBvbmVudHNEYXRhT2Zmc2V0KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29tcG9uZW50c1NjYWxlWCA9IG5ldyBBcnJheShudW1Db21wb25lbnRzKTtcclxuICAgICAgICB2YXIgY29tcG9uZW50c1NjYWxlWSA9IG5ldyBBcnJheShudW1Db21wb25lbnRzKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG51bUNvbXBvbmVudHM7ICsraSkge1xyXG4gICAgICAgICAgICBjb21wb25lbnRzU2NhbGVYW2ldID0gY29tcG9uZW50c0RhdGFCeXRlc1tpICogMyArIDFdO1xyXG4gICAgICAgICAgICBjb21wb25lbnRzU2NhbGVZW2ldID0gY29tcG9uZW50c0RhdGFCeXRlc1tpICogMyArIDJdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICBudW1Db21wb25lbnRzOiBudW1Db21wb25lbnRzLFxyXG4gICAgICAgICAgICBjb21wb25lbnRzU2NhbGVYOiBjb21wb25lbnRzU2NhbGVYLFxyXG4gICAgICAgICAgICBjb21wb25lbnRzU2NhbGVZOiBjb21wb25lbnRzU2NhbGVZLFxyXG4gICAgICAgICAgICBpbWFnZVdpZHRoOiByZWZlcmVuY2VHcmlkU2l6ZVggLSBmaXJzdFRpbGVPZmZzZXRYLFxyXG4gICAgICAgICAgICBpbWFnZUhlaWdodDogcmVmZXJlbmNlR3JpZFNpemVZIC0gZmlyc3RUaWxlT2Zmc2V0WSxcclxuICAgICAgICAgICAgdGlsZVdpZHRoOiB0aWxlU2l6ZVgsXHJcbiAgICAgICAgICAgIHRpbGVIZWlnaHQ6IHRpbGVTaXplWSxcclxuICAgICAgICAgICAgZmlyc3RUaWxlT2Zmc2V0WDogZmlyc3RUaWxlT2Zmc2V0WCxcclxuICAgICAgICAgICAgZmlyc3RUaWxlT2Zmc2V0WTogZmlyc3RUaWxlT2Zmc2V0WVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMucGFyc2VEZWZhdWx0VGlsZVBhcmFtcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBtYWluSGVhZGVyRGF0YWJpbiA9IGRhdGFiaW5zU2F2ZXIuZ2V0TWFpbkhlYWRlckRhdGFiaW4oKTtcclxuXHJcbiAgICAgICAgdmFyIHRpbGVQYXJhbXMgPSBwYXJzZUNvZGluZ1N0eWxlKG1haW5IZWFkZXJEYXRhYmluLCAvKmlzTWFuZGF0b3J5PSovdHJ1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRpbGVQYXJhbXM7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnBhcnNlT3ZlcnJpZGVuVGlsZVBhcmFtcyA9IGZ1bmN0aW9uKHRpbGVJbmRleCkge1xyXG4gICAgICAgIHZhciB0aWxlSGVhZGVyRGF0YWJpbiA9IGRhdGFiaW5zU2F2ZXIuZ2V0VGlsZUhlYWRlckRhdGFiaW4odGlsZUluZGV4KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBBLjQuMiAoU3RhcnQgT2YgVGlsZS1wYXJ0KVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlUGFyYW1zID0gcGFyc2VDb2RpbmdTdHlsZSh0aWxlSGVhZGVyRGF0YWJpbiwgLyppc01hbmRhdG9yeT0qL2ZhbHNlKTtcclxuICAgICAgICByZXR1cm4gdGlsZVBhcmFtcztcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gcGFyc2VDb2RpbmdTdHlsZShkYXRhYmluLCBpc01hbmRhdG9yeSkge1xyXG4gICAgICAgIC8vIEEuNS4xIChJbWFnZSBhbmQgVGlsZSBTaXplKVxyXG5cclxuICAgICAgICB2YXIgYmFzZVBhcmFtcyA9IG9mZnNldHNDYWxjdWxhdG9yLmdldENvZGluZ1N0eWxlQmFzZVBhcmFtcyhcclxuICAgICAgICAgICAgZGF0YWJpbiwgaXNNYW5kYXRvcnkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChiYXNlUGFyYW1zID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIG1haW5IZWFkZXJEYXRhYmluID0gZGF0YWJpbnNTYXZlci5nZXRNYWluSGVhZGVyRGF0YWJpbigpO1xyXG5cclxuICAgICAgICB2YXIgc2l6TWFya2VyT2Zmc2V0ID0gb2Zmc2V0c0NhbGN1bGF0b3IuZ2V0SW1hZ2VBbmRUaWxlU2l6ZU9mZnNldCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBudW1Db21wb25lbnRzT2Zmc2V0ID1cclxuICAgICAgICAgICAgc2l6TWFya2VyT2Zmc2V0ICsgakdsb2JhbHMuajJrT2Zmc2V0cy5OVU1fQ09NUE9ORU5UU19PRkZTRVRfQUZURVJfU0laX01BUktFUjtcclxuXHJcbiAgICAgICAgdmFyIG51bUNvbXBvbmVudHNCeXRlcyA9IGdldEJ5dGVzKFxyXG4gICAgICAgICAgICBtYWluSGVhZGVyRGF0YWJpbixcclxuICAgICAgICAgICAgLypudW1CeXRlcz0qLzIsXHJcbiAgICAgICAgICAgIC8qc3RhcnRPZmZzZXQ9Ki9udW1Db21wb25lbnRzT2Zmc2V0KTtcclxuICAgICAgICB2YXIgbnVtQ29tcG9uZW50cyA9IG1lc3NhZ2VIZWFkZXJQYXJzZXIuZ2V0SW50MTYobnVtQ29tcG9uZW50c0J5dGVzLCAwKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcGFja2VkUGFja2V0SGVhZGVyc01hcmtlckluVGlsZUhlYWRlciA9XHJcbiAgICAgICAgICAgIG1hcmtlcnNQYXJzZXIuZ2V0TWFya2VyT2Zmc2V0SW5EYXRhYmluKFxyXG4gICAgICAgICAgICAgICAgZGF0YWJpbiwgakdsb2JhbHMuajJrTWFya2Vycy5QYWNrZWRQYWNrZXRIZWFkZXJzSW5UaWxlSGVhZGVyKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcGFja2VkUGFja2V0SGVhZGVyc01hcmtlckluTWFpbkhlYWRlciA9XHJcbiAgICAgICAgICAgIG1hcmtlcnNQYXJzZXIuZ2V0TWFya2VyT2Zmc2V0SW5EYXRhYmluKFxyXG4gICAgICAgICAgICAgICAgbWFpbkhlYWRlckRhdGFiaW4sIGpHbG9iYWxzLmoya01hcmtlcnMuUGFja2VkUGFja2V0SGVhZGVyc0luTWFpbkhlYWRlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGlzUGFja2V0SGVhZGVyc05lYXJEYXRhID1cclxuICAgICAgICAgICAgcGFja2VkUGFja2V0SGVhZGVyc01hcmtlckluVGlsZUhlYWRlciA9PT0gbnVsbCAmJlxyXG4gICAgICAgICAgICBwYWNrZWRQYWNrZXRIZWFkZXJzTWFya2VySW5NYWluSGVhZGVyID09PSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjb2RpbmdTdHlsZU1vcmVEYXRhT2Zmc2V0ID0gYmFzZVBhcmFtcy5jb2RpbmdTdHlsZURlZmF1bHRPZmZzZXQgKyA2O1xyXG4gICAgICAgIHZhciBjb2RpbmdTdHlsZU1vcmVEYXRhQnl0ZXMgPSBnZXRCeXRlcyhcclxuICAgICAgICAgICAgZGF0YWJpbixcclxuICAgICAgICAgICAgLypudW1CeXRlcz0qLzYsXHJcbiAgICAgICAgICAgIC8qc3RhcnRPZmZzZXQ9Ki9jb2RpbmdTdHlsZU1vcmVEYXRhT2Zmc2V0KTtcclxuICAgICAgICB2YXIgbnVtUXVhbGl0eUxheWVycyA9IG1lc3NhZ2VIZWFkZXJQYXJzZXIuZ2V0SW50MTYoXHJcbiAgICAgICAgICAgIGNvZGluZ1N0eWxlTW9yZURhdGFCeXRlcywgMCk7XHJcblxyXG4gICAgICAgIHZhciBjb2RlYmxvY2tXaWR0aCA9IHBhcnNlQ29kZWJsb2NrU2l6ZShcclxuICAgICAgICAgICAgY29kaW5nU3R5bGVNb3JlRGF0YUJ5dGVzLCA0KTtcclxuICAgICAgICB2YXIgY29kZWJsb2NrSGVpZ2h0ID0gcGFyc2VDb2RlYmxvY2tTaXplKFxyXG4gICAgICAgICAgICBjb2RpbmdTdHlsZU1vcmVEYXRhQnl0ZXMsIDUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwcmVjaW5jdFdpZHRocyA9IG5ldyBBcnJheShiYXNlUGFyYW1zLm51bVJlc29sdXRpb25MZXZlbHMpO1xyXG4gICAgICAgIHZhciBwcmVjaW5jdEhlaWdodHMgPSBuZXcgQXJyYXkoYmFzZVBhcmFtcy5udW1SZXNvbHV0aW9uTGV2ZWxzKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcHJlY2luY3RTaXplc0J5dGVzID0gbnVsbDtcclxuICAgICAgICBpZiAoIWJhc2VQYXJhbXMuaXNEZWZhdWx0UHJlY2luY3RTaXplKSB7XHJcbiAgICAgICAgICAgIHZhciBwcmVjaW5jdFNpemVzQnl0ZXNOZWVkZWQgPSBiYXNlUGFyYW1zLm51bVJlc29sdXRpb25MZXZlbHM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBwcmVjaW5jdFNpemVzQnl0ZXMgPSBnZXRCeXRlcyhcclxuICAgICAgICAgICAgICAgIGRhdGFiaW4sXHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdFNpemVzQnl0ZXNOZWVkZWQsXHJcbiAgICAgICAgICAgICAgICBiYXNlUGFyYW1zLnByZWNpbmN0U2l6ZXNPZmZzZXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGRlZmF1bHRTaXplID0gMSA8PCAxNTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJhc2VQYXJhbXMubnVtUmVzb2x1dGlvbkxldmVsczsgKytpKSB7XHJcbiAgICAgICAgICAgIGlmIChiYXNlUGFyYW1zLmlzRGVmYXVsdFByZWNpbmN0U2l6ZSkge1xyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RXaWR0aHNbaV0gPSBkZWZhdWx0U2l6ZTtcclxuICAgICAgICAgICAgICAgIHByZWNpbmN0SGVpZ2h0c1tpXSA9IGRlZmF1bHRTaXplO1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBwcmVjaW5jdFNpemVPZmZzZXQgPSBpO1xyXG4gICAgICAgICAgICB2YXIgc2l6ZUV4cG9uZW50cyA9IHByZWNpbmN0U2l6ZXNCeXRlc1twcmVjaW5jdFNpemVPZmZzZXRdO1xyXG4gICAgICAgICAgICB2YXIgcHB4ID0gc2l6ZUV4cG9uZW50cyAmIDB4MEY7XHJcbiAgICAgICAgICAgIHZhciBwcHkgPSBzaXplRXhwb25lbnRzID4+PiA0O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcHJlY2luY3RXaWR0aHNbaV0gPSAxICogTWF0aC5wb3coMiwgcHB4KTsgLy8gQXZvaWQgbmVnYXRpdmUgcmVzdWx0IGR1ZSB0byBzaWduZWQgY2FsY3VsYXRpb25cclxuICAgICAgICAgICAgcHJlY2luY3RIZWlnaHRzW2ldID0gMSAqIE1hdGgucG93KDIsIHBweSk7IC8vIEF2b2lkIG5lZ2F0aXZlIHJlc3VsdCBkdWUgdG8gc2lnbmVkIGNhbGN1bGF0aW9uXHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwYXJhbXNQZXJDb21wb25lbnQgPSBuZXcgQXJyYXkobnVtQ29tcG9uZW50cyk7XHJcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBudW1Db21wb25lbnRzOyArK2opIHtcclxuICAgICAgICAgICAgcGFyYW1zUGVyQ29tcG9uZW50W2pdID0ge1xyXG4gICAgICAgICAgICAgICAgbWF4Q29kZWJsb2NrV2lkdGg6IGNvZGVibG9ja1dpZHRoLFxyXG4gICAgICAgICAgICAgICAgbWF4Q29kZWJsb2NrSGVpZ2h0OiBjb2RlYmxvY2tIZWlnaHQsXHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIG51bVJlc29sdXRpb25MZXZlbHM6IGJhc2VQYXJhbXMubnVtUmVzb2x1dGlvbkxldmVscyxcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3RXaWR0aFBlckxldmVsOiBwcmVjaW5jdFdpZHRocyxcclxuICAgICAgICAgICAgICAgIHByZWNpbmN0SGVpZ2h0UGVyTGV2ZWw6IHByZWNpbmN0SGVpZ2h0c1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgZGVmYXVsdENvbXBvbmVudFBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbWF4Q29kZWJsb2NrV2lkdGg6IGNvZGVibG9ja1dpZHRoLFxyXG4gICAgICAgICAgICBtYXhDb2RlYmxvY2tIZWlnaHQ6IGNvZGVibG9ja0hlaWdodCxcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIG51bVJlc29sdXRpb25MZXZlbHM6IGJhc2VQYXJhbXMubnVtUmVzb2x1dGlvbkxldmVscyxcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHByZWNpbmN0V2lkdGhQZXJMZXZlbDogcHJlY2luY3RXaWR0aHMsXHJcbiAgICAgICAgICAgIHByZWNpbmN0SGVpZ2h0UGVyTGV2ZWw6IHByZWNpbmN0SGVpZ2h0c1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlUGFyYW1zID0ge1xyXG4gICAgICAgICAgICBudW1RdWFsaXR5TGF5ZXJzOiBudW1RdWFsaXR5TGF5ZXJzLFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaXNQYWNrZXRIZWFkZXJzTmVhckRhdGE6IGlzUGFja2V0SGVhZGVyc05lYXJEYXRhLFxyXG4gICAgICAgICAgICBpc1N0YXJ0T2ZQYWNrZXRNYXJrZXJBbGxvd2VkOiBiYXNlUGFyYW1zLmlzU3RhcnRPZlBhY2tldE1hcmtlckFsbG93ZWQsXHJcbiAgICAgICAgICAgIGlzRW5kUGFja2V0SGVhZGVyTWFya2VyQWxsb3dlZDogYmFzZVBhcmFtcy5pc0VuZFBhY2tldEhlYWRlck1hcmtlckFsbG93ZWQsXHJcblxyXG4gICAgICAgICAgICBwYXJhbXNQZXJDb21wb25lbnQ6IHBhcmFtc1BlckNvbXBvbmVudCxcclxuICAgICAgICAgICAgZGVmYXVsdENvbXBvbmVudFBhcmFtczogZGVmYXVsdENvbXBvbmVudFBhcmFtc1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aWxlUGFyYW1zO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBwYXJzZUNvZGVibG9ja1NpemUoYnl0ZXMsIG9mZnNldCkge1xyXG4gICAgICAgIHZhciBjb2RlYmxvY2tTaXplRXhwb25lbnRNaW51czIgPSBieXRlc1tvZmZzZXRdO1xyXG4gICAgICAgIHZhciBjb2RlYmxvY2tTaXplRXhwb25lbnQgPSAyICsgKGNvZGVibG9ja1NpemVFeHBvbmVudE1pbnVzMiAmIDB4MEYpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjb2RlYmxvY2tTaXplRXhwb25lbnQgPiAxMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuajJrRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdJbGxlZ2FsIGNvZGVibG9jayB3aWR0aCBleHBvbmVudCAnICsgY29kZWJsb2NrU2l6ZUV4cG9uZW50LFxyXG4gICAgICAgICAgICAgICAgJ0EuNi4xLCBUYWJsZSBBLjE4Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzaXplID0gMSA8PCBjb2RlYmxvY2tTaXplRXhwb25lbnQ7XHJcbiAgICAgICAgcmV0dXJuIHNpemU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEJ5dGVzKGRhdGFiaW4sIG51bUJ5dGVzLCBkYXRhYmluU3RhcnRPZmZzZXQsIGFsbG93RW5kT2ZSYW5nZSkge1xyXG4gICAgICAgIHZhciBieXRlcyA9IFtdO1xyXG5cclxuICAgICAgICB2YXIgcmFuZ2VPcHRpb25zID0ge1xyXG4gICAgICAgICAgICBmb3JjZUNvcHlBbGxSYW5nZTogdHJ1ZSxcclxuICAgICAgICAgICAgbWF4TGVuZ3RoVG9Db3B5OiBudW1CeXRlcyxcclxuICAgICAgICAgICAgZGF0YWJpblN0YXJ0T2Zmc2V0OiBkYXRhYmluU3RhcnRPZmZzZXRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXNDb3BpZWQgPSBkYXRhYmluLmNvcHlCeXRlcyhieXRlcywgLypzdGFydE9mZnNldD0qLzAsIHJhbmdlT3B0aW9ucyk7XHJcbiAgICAgICAgaWYgKGJ5dGVzQ29waWVkID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ0hlYWRlciBkYXRhLWJpbiBoYXMgbm90IHlldCByZWNpZXZlZCAnICsgbnVtQnl0ZXMgK1xyXG4gICAgICAgICAgICAgICAgJyBieXRlcyBzdGFydGluZyBmcm9tIG9mZnNldCAnICsgZGF0YWJpblN0YXJ0T2Zmc2V0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGJ5dGVzO1xyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSnBpcENoYW5uZWwoXHJcbiAgICBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCwgc2Vzc2lvbkhlbHBlciwganBpcEZhY3RvcnkpIHtcclxuICAgIFxyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgdmFyIGNoYW5uZWxJZCA9IG51bGw7XHJcbiAgICB2YXIgcmVxdWVzdElkID0gMDtcclxuICAgIHZhciByZXF1ZXN0c1dhaXRpbmdGb3JDaGFubmVsQ3JlYXRpb24gPSBbXTtcclxuICAgIHZhciByZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZSA9IFtdO1xyXG4gICAgdmFyIGlzRGVkaWNhdGVkRm9yTW92YWJsZVJlcXVlc3QgPSBmYWxzZTtcclxuICAgIFxyXG4gICAgdGhpcy5yZXF1ZXN0RGF0YSA9IGZ1bmN0aW9uIHJlcXVlc3REYXRhKFxyXG4gICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgIGNhbGxiYWNrLFxyXG4gICAgICAgIGZhaWx1cmVDYWxsYmFjayxcclxuICAgICAgICBudW1RdWFsaXR5TGF5ZXJzKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFpc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0KSB7XHJcbiAgICAgICAgICAgIC8vIE5vIG5lZWQgdG8gY2hlY2sgaWYgdGhlcmUgYXJlIHRvbyBtYW55IGNvbmN1cnJlbnQgcmVxdWVzdHNcclxuICAgICAgICAgICAgLy8gaWYgY2hhbm5lbCB3YXMgZGVkaWNhdGVkIGZvciBtb3ZhYmxlIHJlcXVlc3QuIFRoZSByZWFzb24gaXNcclxuICAgICAgICAgICAgLy8gdGhhdCBhbnkgcmVxdWVzdCBpbiBkZWRpY2F0ZWQgY2hhbm5lbCBjYW5jZWwgdGhlIHByZXZpb3VzIG9uZS5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBhbGxXYWl0aW5nUmVxdWVzdHMgPSBnZXRBbGxRdWV1ZWRSZXF1ZXN0Q291bnQoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChhbGxXYWl0aW5nUmVxdWVzdHMgPj0gbWF4UmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VJbkNoYW5uZWwpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdDaGFubmVsIGhhcyB0b28gbWFueSByZXF1ZXN0cyBub3QgcmVzcG9uZGVkIHlldCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgdXJsID0gY3JlYXRlUmVxdWVzdFVybChjb2Rlc3RyZWFtUGFydFBhcmFtcywgbnVtUXVhbGl0eUxheWVycyk7XHJcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBqcGlwRmFjdG9yeS5jcmVhdGVSZXF1ZXN0KFxyXG4gICAgICAgICAgICBzZXNzaW9uSGVscGVyLFxyXG4gICAgICAgICAgICBzZWxmLFxyXG4gICAgICAgICAgICB1cmwsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrLFxyXG4gICAgICAgICAgICBmYWlsdXJlQ2FsbGJhY2spO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjaGFubmVsSWQgIT09IG51bGwgfHwgcmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2UubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJlcXVlc3RzV2FpdGluZ0ZvclJlc3BvbnNlLnB1c2gocmVxdWVzdCk7XHJcbiAgICAgICAgICAgIHJlcXVlc3Quc3RhcnRSZXF1ZXN0KCk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0KSB7XHJcbiAgICAgICAgICAgIC8vIFRob3NlIHJlcXVlc3RzIGNhbmNlbCBhbGwgcHJldmlvdXMgcmVxdWVzdHMgaW4gY2hhbm5lbCwgc28gbm9cclxuICAgICAgICAgICAgLy8gbmVlZCB0byBsb2cgb2xkIHJlcXVlc3RzXHJcbiAgICAgICAgICAgIHJlcXVlc3RzV2FpdGluZ0ZvckNoYW5uZWxDcmVhdGlvbiA9IFtyZXF1ZXN0XTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXF1ZXN0c1dhaXRpbmdGb3JDaGFubmVsQ3JlYXRpb24ucHVzaChyZXF1ZXN0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnNlbmRNaW5pbWFsUmVxdWVzdCA9IGZ1bmN0aW9uIHNlbmRNaW5pbWFsUmVxdWVzdChjYWxsYmFjaykge1xyXG4gICAgICAgIGlmIChjaGFubmVsSWQgPT09IG51bGwgJiYgcmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2UubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdNaW5pbWFsIHJlcXVlc3RzIHNob3VsZCBiZSB1c2VkIGZvciBmaXJzdCByZXF1ZXN0IG9yIGtlZXAgJyArXHJcbiAgICAgICAgICAgICAgICAnYWxpdmUgbWVzc2FnZS4gS2VlcCBhbGl2ZSByZXF1aXJlcyBhbiBhbHJlYWR5IGluaXRpYWxpemVkICcgK1xyXG4gICAgICAgICAgICAgICAgJ2NoYW5uZWwsIGFuZCBmaXJzdCByZXF1ZXN0IHJlcXVpcmVzIHRvIG5vdCBoYXZlIGFueSAnICtcclxuICAgICAgICAgICAgICAgICdwcmV2aW91cyByZXF1ZXN0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB1cmwgPSBjcmVhdGVNaW5pbWFsUmVxdWVzdFVybCgpO1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0ganBpcEZhY3RvcnkuY3JlYXRlUmVxdWVzdChcclxuICAgICAgICAgICAgc2Vzc2lvbkhlbHBlciwgc2VsZiwgdXJsLCBjYWxsYmFjayk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2UucHVzaChyZXF1ZXN0KTtcclxuICAgICAgICByZXF1ZXN0LnN0YXJ0UmVxdWVzdCgpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRJc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0ID1cclxuICAgICAgICBmdW5jdGlvbiBnZXRJc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0KCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBpc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5kZWRpY2F0ZUZvck1vdmFibGVSZXF1ZXN0ID0gZnVuY3Rpb24gZGVkaWNhdGVGb3JNb3ZhYmxlUmVxdWVzdCgpIHtcclxuICAgICAgICBpZiAoaXNEZWRpY2F0ZWRGb3JNb3ZhYmxlUmVxdWVzdCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDaGFubmVsIGFscmVhZHkgZGVkaWNhdGVkIGZvciBtb3ZhYmxlIHJlcXVlc3QnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaXNEZWRpY2F0ZWRGb3JNb3ZhYmxlUmVxdWVzdCA9IHRydWU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldENoYW5uZWxJZCA9IGZ1bmN0aW9uIGdldENoYW5uZWxJZCgpIHtcclxuICAgICAgICByZXR1cm4gY2hhbm5lbElkO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5zZXRDaGFubmVsSWQgPSBmdW5jdGlvbiBzZXRDaGFubmVsSWQobmV3Q2hhbm5lbElkKSB7XHJcbiAgICAgICAgaWYgKG5ld0NoYW5uZWxJZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNoYW5uZWxJZCA9IG5ld0NoYW5uZWxJZDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVxdWVzdHNUb1NlbmQgPSByZXF1ZXN0c1dhaXRpbmdGb3JDaGFubmVsQ3JlYXRpb247XHJcbiAgICAgICAgcmVxdWVzdHNXYWl0aW5nRm9yQ2hhbm5lbENyZWF0aW9uID0gW107XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXF1ZXN0c1RvU2VuZC5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICByZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZS5wdXNoKHJlcXVlc3RzVG9TZW5kW2ldKTtcclxuICAgICAgICAgICAgcmVxdWVzdHNUb1NlbmRbaV0uc3RhcnRSZXF1ZXN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5uZXh0UmVxdWVzdElkID0gZnVuY3Rpb24gbmV4dFJlcXVlc3RJZCgpIHtcclxuICAgICAgICByZXR1cm4gKytyZXF1ZXN0SWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFJlcXVlc3RzV2FpdGluZ0ZvclJlc3BvbnNlID1cclxuICAgICAgICBmdW5jdGlvbiBnZXRSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZSgpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2U7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEFsbFF1ZXVlZFJlcXVlc3RDb3VudCA9IGdldEFsbFF1ZXVlZFJlcXVlc3RDb3VudDtcclxuICAgIFxyXG4gICAgdGhpcy5yZXF1ZXN0RW5kZWQgPSBmdW5jdGlvbiByZXF1ZXN0RW5kZWQoYWpheFJlc3BvbnNlLCByZXF1ZXN0KSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3RzID0gcmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2U7XHJcbiAgICAgICAgdmFyIGlzRm91bmQgPSBmYWxzZTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcXVlc3RzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0c1tpXSA9PT0gcmVxdWVzdCkge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdHNbaV0gPSByZXF1ZXN0c1tyZXF1ZXN0cy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3RzLmxlbmd0aCAtPSAxO1xyXG4gICAgICAgICAgICAgICAgaXNGb3VuZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoIWlzRm91bmQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnY2hhbm5lbC5yZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZSBpbmNvbnNpc3RlbmN5Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHNlc3Npb25IZWxwZXIucmVxdWVzdEVuZGVkKGFqYXhSZXNwb25zZSwgc2VsZik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNoYW5uZWxJZCA9PT0gbnVsbCAmJiByZXF1ZXN0c1dhaXRpbmdGb3JDaGFubmVsQ3JlYXRpb24ubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAvLyBJZiBub3Qgc3VjY2VlZGVkIHRvIGNyZWF0ZSBhIGNoYW5uZWwgSUQgeWV0LFxyXG4gICAgICAgICAgICAvLyBwZXJmb3JtIGFuIGFkZGl0aW9uYWwgcmVxdWVzdFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG5leHRSZXF1ZXN0ID0gcmVxdWVzdHNXYWl0aW5nRm9yQ2hhbm5lbENyZWF0aW9uLnNoaWZ0KCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZS5wdXNoKG5leHRSZXF1ZXN0KTtcclxuICAgICAgICAgICAgbmV4dFJlcXVlc3Quc3RhcnRSZXF1ZXN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5pc0FsbE9sZFJlcXVlc3RzRW5kZWQgPSBmdW5jdGlvbiBpc0FsbE9sZFJlcXVlc3RzRW5kZWQocHJpb3JUb0lkKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZS5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBpZiAocmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VbaV0ubGFzdFJlcXVlc3RJZCA8PSBwcmlvclRvSWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEFsbFF1ZXVlZFJlcXVlc3RDb3VudCgpIHtcclxuICAgICAgICB2YXIgYWxsV2FpdGluZ1JlcXVlc3RzID1cclxuICAgICAgICAgICAgcmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2UubGVuZ3RoICtcclxuICAgICAgICAgICAgcmVxdWVzdHNXYWl0aW5nRm9yQ2hhbm5lbENyZWF0aW9uLmxlbmd0aDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gYWxsV2FpdGluZ1JlcXVlc3RzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVNaW5pbWFsUmVxdWVzdFVybChhbGxvd1N0b3BQcmV2aW91c1JlcXVlc3RzSW5DaGFubmVsKSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3RVcmwgPSBzZXNzaW9uSGVscGVyLmdldERhdGFSZXF1ZXN0VXJsKCk7XHJcbiAgICAgICAgdmFyIHRhcmdldElkID0gc2Vzc2lvbkhlbHBlci5nZXRUYXJnZXRJZCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0YXJnZXRJZCAhPT0gJzAnKSB7XHJcbiAgICAgICAgICAgIHJlcXVlc3RVcmwgKz0gJyZ0aWQ9JyArIHRhcmdldElkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgYWxyZWFkeVNlbnRNZXNzYWdlc09uQ2hhbm5lbCA9IGNoYW5uZWxJZCAhPT0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoYWxyZWFkeVNlbnRNZXNzYWdlc09uQ2hhbm5lbCkge1xyXG4gICAgICAgICAgICB2YXIgaXNTdG9wUHJldmlvdXMgPVxyXG4gICAgICAgICAgICAgICAgaXNEZWRpY2F0ZWRGb3JNb3ZhYmxlUmVxdWVzdCAmJlxyXG4gICAgICAgICAgICAgICAgYWxsb3dTdG9wUHJldmlvdXNSZXF1ZXN0c0luQ2hhbm5lbDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChpc1N0b3BQcmV2aW91cykge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdFVybCArPSAnJndhaXQ9bm8nO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdFVybCArPSAnJndhaXQ9eWVzJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVxdWVzdFVybDtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVJlcXVlc3RVcmwoY29kZXN0cmVhbVBhcnRQYXJhbXMsIG51bVF1YWxpdHlMYXllcnMpIHtcclxuICAgICAgICB2YXIgcmVxdWVzdFVybCA9IGNyZWF0ZU1pbmltYWxSZXF1ZXN0VXJsKFxyXG4gICAgICAgICAgICAvKmFsbG93U3RvcFByZXZpb3VzUmVxdWVzdHNJbkNoYW5uZWw9Ki90cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29kZXN0cmVhbVN0cnVjdHVyZSA9IHNlc3Npb25IZWxwZXIuZ2V0Q29kZXN0cmVhbVN0cnVjdHVyZSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBmcmFtZVdpZHRoID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRMZXZlbFdpZHRoKFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5sZXZlbCk7XHJcbiAgICAgICAgdmFyIGZyYW1lSGVpZ2h0ID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRMZXZlbEhlaWdodChcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMubGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByZWdpb25XaWR0aCA9XHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1heFhFeGNsdXNpdmUgLSBjb2Rlc3RyZWFtUGFydFBhcmFtcy5taW5YO1xyXG4gICAgICAgIHZhciByZWdpb25IZWlnaHQgPVxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcy5tYXhZRXhjbHVzaXZlIC0gY29kZXN0cmVhbVBhcnRQYXJhbXMubWluWTtcclxuICAgICAgICBcclxuICAgICAgICByZXF1ZXN0VXJsICs9XHJcbiAgICAgICAgICAgICcmZnNpej0nICsgZnJhbWVXaWR0aCArICcsJyArIGZyYW1lSGVpZ2h0ICsgJyxjbG9zZXN0JyArXHJcbiAgICAgICAgICAgICcmcnNpej0nICsgcmVnaW9uV2lkdGggKyAnLCcgKyByZWdpb25IZWlnaHQgK1xyXG4gICAgICAgICAgICAnJnJvZmY9JyArIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLm1pblggKyAnLCcgKyBjb2Rlc3RyZWFtUGFydFBhcmFtcy5taW5ZO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBpZiAobnVtUXVhbGl0eUxheWVycyAhPT0gJ21heCcpIHtcclxuICAgICAgICAgICAgcmVxdWVzdFVybCArPSAnJmxheWVycz0nICsgbnVtUXVhbGl0eUxheWVycztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlcXVlc3RVcmw7XHJcbiAgICB9XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxudmFyIGpwaXBNZXNzYWdlSGVhZGVyUGFyc2VyID0ge1xyXG4gICAgICAgIFxyXG4gICAgTFNCX01BU0s6IDB4MSxcclxuICAgIEJJVF80X01BU0s6IDB4MTAsXHJcbiAgICBCSVRTXzU2X01BU0s6IDB4NjAsXHJcbiAgICBNU0JfTUFTSzogMHg4MCxcclxuXHJcbiAgICBMU0JfN19NQVNLOiAweDdGLFxyXG5cclxuICAgIC8vIEEuMi4xXHJcbiAgICBwYXJzZU51bWJlckluVmJhczogZnVuY3Rpb24gcGFyc2VOdW1iZXJJblZiYXNDbG9zdXJlKFxyXG4gICAgICAgIG1lc3NhZ2UsIHN0YXJ0T2Zmc2V0LCBiaXRzVG9UYWtlSW5GaXJzdEJ5dGUpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2VsZiA9IGpwaXBNZXNzYWdlSGVhZGVyUGFyc2VyO1xyXG4gICAgICAgIHZhciBjdXJyZW50T2Zmc2V0ID0gc3RhcnRPZmZzZXQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdDtcclxuICAgICAgICBpZiAoYml0c1RvVGFrZUluRmlyc3RCeXRlKSB7XHJcbiAgICAgICAgICAgIHZhciBtYXNrRmlyc3RCeXRlID0gKDEgPDwgYml0c1RvVGFrZUluRmlyc3RCeXRlKSAtIDE7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IG1lc3NhZ2VbY3VycmVudE9mZnNldF0gJiBtYXNrRmlyc3RCeXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gbWVzc2FnZVtjdXJyZW50T2Zmc2V0XSAmIHNlbGYuTFNCXzdfTUFTSztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKCAhIShtZXNzYWdlW2N1cnJlbnRPZmZzZXRdICYgc2VsZi5NU0JfTUFTSykgKSB7XHJcbiAgICAgICAgICAgICsrY3VycmVudE9mZnNldDtcclxuXHJcbiAgICAgICAgICAgIHJlc3VsdCA8PD0gNztcclxuICAgICAgICAgICAgcmVzdWx0IHw9IG1lc3NhZ2VbY3VycmVudE9mZnNldF0gJiBzZWxmLkxTQl83X01BU0s7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGVuZE9mZnNldDogY3VycmVudE9mZnNldCArIDEsXHJcbiAgICAgICAgICAgIG51bWJlcjogcmVzdWx0XHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIC8vIEEuMlxyXG4gICAgcGFyc2VNZXNzYWdlSGVhZGVyOiBmdW5jdGlvbiBwYXJzZU1lc3NhZ2VIZWFkZXJDbG9zdXJlKFxyXG4gICAgICAgIG1lc3NhZ2UsIHN0YXJ0T2Zmc2V0LCBwcmV2aW91c01lc3NhZ2VIZWFkZXIpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2VsZiA9IGpwaXBNZXNzYWdlSGVhZGVyUGFyc2VyO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEEuMi4xXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gRmlyc3QgVmJhczogQmluLUlEXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNsYXNzQW5kQ3NuUHJlY2Vuc2UgPSAobWVzc2FnZVtzdGFydE9mZnNldF0gJiBzZWxmLkJJVFNfNTZfTUFTSykgPj4+IDU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNsYXNzQW5kQ3NuUHJlY2Vuc2UgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLlBhcnNlRXhjZXB0aW9uKCdGYWlsZWQgcGFyc2luZyBtZXNzYWdlIGhlYWRlciAnICtcclxuICAgICAgICAgICAgICAgICcoQS4yLjEpOiBwcm9oaWJpdGVkIGV4aXN0YW5jZSBjbGFzcyBhbmQgY3NuIGJpdHMgMDAnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGhhc0NsYXNzVmJhcyA9ICEhKGNsYXNzQW5kQ3NuUHJlY2Vuc2UgJiAweDIpO1xyXG4gICAgICAgIHZhciBoYXNDb2RlU3RyZWFtSW5kZXhWYmFzID0gY2xhc3NBbmRDc25QcmVjZW5zZSA9PT0gMztcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaXNMYXN0Qnl0ZUluRGF0YWJpbiA9ICEhKG1lc3NhZ2Vbc3RhcnRPZmZzZXRdICYgc2VsZi5CSVRfNF9NQVNLKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBBLjIuM1xyXG4gICAgICAgIHZhciBwYXJzZWRJbkNsYXNzSWQgPSBzZWxmLnBhcnNlTnVtYmVySW5WYmFzKFxyXG4gICAgICAgICAgICBtZXNzYWdlLCBzdGFydE9mZnNldCwgLypiaXRzVG9UYWtlSW5GaXJzdEJ5dGU9Ki80KTtcclxuICAgICAgICB2YXIgaW5DbGFzc0lkID0gcGFyc2VkSW5DbGFzc0lkLm51bWJlcjtcclxuICAgICAgICB2YXIgY3VycmVudE9mZnNldCA9IHBhcnNlZEluQ2xhc3NJZC5lbmRPZmZzZXQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU2Vjb25kIG9wdGlvbmFsIFZiYXM6IENsYXNzIElEXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNsYXNzSWQgPSAwO1xyXG4gICAgICAgIGlmIChoYXNDbGFzc1ZiYXMpIHtcclxuICAgICAgICAgICAgdmFyIHBhcnNlZENsYXNzSWQgPSBzZWxmLnBhcnNlTnVtYmVySW5WYmFzKG1lc3NhZ2UsIGN1cnJlbnRPZmZzZXQpO1xyXG4gICAgICAgICAgICBjbGFzc0lkID0gcGFyc2VkQ2xhc3NJZC5udW1iZXI7XHJcbiAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQgPSBwYXJzZWRDbGFzc0lkLmVuZE9mZnNldDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAocHJldmlvdXNNZXNzYWdlSGVhZGVyKSB7XHJcbiAgICAgICAgICAgIGNsYXNzSWQgPSBwcmV2aW91c01lc3NhZ2VIZWFkZXIuY2xhc3NJZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gVGhpcmQgb3B0aW9uYWwgVmJhczogQ29kZSBTdHJlYW0gSW5kZXggKENzbilcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29kZXN0cmVhbUluZGV4ID0gMDtcclxuICAgICAgICBpZiAoaGFzQ29kZVN0cmVhbUluZGV4VmJhcykge1xyXG4gICAgICAgICAgICB2YXIgcGFyc2VkQ3NuID0gc2VsZi5wYXJzZU51bWJlckluVmJhcyhtZXNzYWdlLCBjdXJyZW50T2Zmc2V0KTtcclxuICAgICAgICAgICAgY29kZXN0cmVhbUluZGV4ID0gcGFyc2VkQ3NuLm51bWJlcjtcclxuICAgICAgICAgICAgY3VycmVudE9mZnNldCA9IHBhcnNlZENzbi5lbmRPZmZzZXQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHByZXZpb3VzTWVzc2FnZUhlYWRlcikge1xyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtSW5kZXggPSBwcmV2aW91c01lc3NhZ2VIZWFkZXIuY29kZXN0cmVhbUluZGV4O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyA0dGggVmJhczogTWVzc2FnZSBvZmZzZXRcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcGFyc2VkT2Zmc2V0ID0gc2VsZi5wYXJzZU51bWJlckluVmJhcyhtZXNzYWdlLCBjdXJyZW50T2Zmc2V0KTtcclxuICAgICAgICB2YXIgbWVzc2FnZU9mZnNldEZyb21EYXRhYmluU3RhcnQgPSBwYXJzZWRPZmZzZXQubnVtYmVyO1xyXG4gICAgICAgIGN1cnJlbnRPZmZzZXQgPSBwYXJzZWRPZmZzZXQuZW5kT2Zmc2V0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIDV0aCBWYmFzOiBNZXNzYWdlIGxlbmd0aFxyXG5cclxuICAgICAgICB2YXIgcGFyc2VkTGVuZ3RoID0gc2VsZi5wYXJzZU51bWJlckluVmJhcyhtZXNzYWdlLCBjdXJyZW50T2Zmc2V0KTtcclxuICAgICAgICB2YXIgbWVzc2FnZUJvZHlMZW5ndGggPSBwYXJzZWRMZW5ndGgubnVtYmVyO1xyXG4gICAgICAgIGN1cnJlbnRPZmZzZXQgPSBwYXJzZWRMZW5ndGguZW5kT2Zmc2V0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIDZ0aCBvcHRpb25hbCBWYmFzOiBBdXhcclxuICAgICAgICBcclxuICAgICAgICAvLyBBLjIuMlxyXG4gICAgICAgIHZhciBoYXNBdXhWYmFzID0gISEoY2xhc3NJZCAmIHNlbGYuTFNCX01BU0spO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBhdXg7XHJcbiAgICAgICAgaWYgKGhhc0F1eFZiYXMpIHtcclxuICAgICAgICAgICAgdmFyIHBhcnNlZEF1eCA9IHNlbGYucGFyc2VOdW1iZXJJblZiYXMobWVzc2FnZSwgY3VycmVudE9mZnNldCk7XHJcbiAgICAgICAgICAgIGF1eCA9IHBhcnNlZEF1eC5udW1iZXI7XHJcbiAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQgPSBwYXJzZWRBdXguZW5kT2Zmc2V0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBSZXR1cm5cclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICBpc0xhc3RCeXRlSW5EYXRhYmluOiBpc0xhc3RCeXRlSW5EYXRhYmluLFxyXG4gICAgICAgICAgICBpbkNsYXNzSWQ6IGluQ2xhc3NJZCxcclxuICAgICAgICAgICAgYm9keVN0YXJ0OiBjdXJyZW50T2Zmc2V0LFxyXG4gICAgICAgICAgICBjbGFzc0lkOiBjbGFzc0lkLFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtSW5kZXg6IGNvZGVzdHJlYW1JbmRleCxcclxuICAgICAgICAgICAgbWVzc2FnZU9mZnNldEZyb21EYXRhYmluU3RhcnQ6IG1lc3NhZ2VPZmZzZXRGcm9tRGF0YWJpblN0YXJ0LFxyXG4gICAgICAgICAgICBtZXNzYWdlQm9keUxlbmd0aDogbWVzc2FnZUJvZHlMZW5ndGhcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChoYXNBdXhWYmFzKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdC5hdXggPSBhdXg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBnZXRJbnQzMjogZnVuY3Rpb24gZ2V0SW50MzJDbG9zdXJlKGRhdGEsIG9mZnNldCkge1xyXG4gICAgICAgIHZhciBtc2IgPSBkYXRhW29mZnNldF0gKiBNYXRoLnBvdygyLCAyNCk7IC8vIEF2b2lkIG5lZ2F0aXZlIHJlc3VsdCBkdWUgdG8gc2lnbmVkIGNhbGN1bGF0aW9uXHJcbiAgICAgICAgdmFyIGJ5dGUyID0gZGF0YVtvZmZzZXQgKyAxXSA8PCAxNjtcclxuICAgICAgICB2YXIgYnl0ZTEgPSBkYXRhW29mZnNldCArIDJdIDw8IDg7XHJcbiAgICAgICAgdmFyIGxzYiA9IGRhdGFbb2Zmc2V0ICsgM107XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG1zYiArIGJ5dGUyICsgYnl0ZTEgKyBsc2I7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGdldEludDE2OiBmdW5jdGlvbiBnZXRJbnQxNkNsb3N1cmUoZGF0YSwgb2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIG1zYiA9IGRhdGFbb2Zmc2V0XSA8PCA4O1xyXG4gICAgICAgIHZhciBsc2IgPSBkYXRhW29mZnNldCArIDFdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByZXN1bHQgPSBtc2IgKyBsc2I7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ganBpcE1lc3NhZ2VIZWFkZXJQYXJzZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwUmVjb25uZWN0YWJsZVJlcXVlc3RlcihcclxuICAgIG1heENoYW5uZWxzSW5TZXNzaW9uLFxyXG4gICAgbWF4UmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VJbkNoYW5uZWwsIFxyXG4gICAgY29kZXN0cmVhbVN0cnVjdHVyZSxcclxuICAgIGRhdGFiaW5zU2F2ZXIsXHJcbiAgICBqcGlwRmFjdG9yeSxcclxuICAgIC8vIE5PVEU6IE1vdmUgcGFyYW1ldGVyIHRvIGJlZ2lubmluZyBhbmQgZXhwb3NlIGluIENvZGVzdHJlYW1DbGllbnRcclxuICAgIG1heEpwaXBDYWNoZVNpemVDb25maWcpIHtcclxuICAgIFxyXG4gICAgdmFyIE1CID0gMTA0ODU3NjtcclxuICAgIHZhciBtYXhKcGlwQ2FjaGVTaXplID0gbWF4SnBpcENhY2hlU2l6ZUNvbmZpZyB8fCAoMTAgKiBNQik7XHJcbiAgICBcclxuICAgIHZhciBzZXNzaW9uV2FpdGluZ0ZvclJlYWR5O1xyXG4gICAgdmFyIGFjdGl2ZVNlc3Npb24gPSBudWxsO1xyXG4gICAgdmFyIHNlc3Npb25XYWl0aW5nRm9yRGlzY29ubmVjdCA9IG51bGw7XHJcbiAgICBcclxuICAgIHZhciB1cmwgPSBudWxsO1xyXG4gICAgdmFyIHdhaXRpbmdGb3JDbG9zZVNlc3Npb25zID0gMDtcclxuICAgIFxyXG4gICAgdmFyIG5vbkRlZGljYXRlZFJlcXVlc3RzV2FpdGluZ0ZvclNlbmQgPSBbXTtcclxuICAgIHZhciBkZWRpY2F0ZWRDaGFubmVscyA9IFtdO1xyXG4gICAgXHJcbiAgICB2YXIgc3RhdHVzQ2FsbGJhY2sgPSBudWxsO1xyXG4gICAgdmFyIGxhc3RDbG9zZWRDYWxsYmFjayA9IG51bGw7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0SXNSZWFkeSA9IGZ1bmN0aW9uIGdldElzUmVhZHkoKSB7XHJcbiAgICAgICAgcmV0dXJuIGFjdGl2ZVNlc3Npb24gIT09IG51bGwgJiYgYWN0aXZlU2Vzc2lvbi5nZXRJc1JlYWR5KCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLm9wZW4gPSBmdW5jdGlvbiBvcGVuKGJhc2VVcmwpIHtcclxuICAgICAgICBpZiAoYmFzZVVybCA9PT0gdW5kZWZpbmVkIHx8IGJhc2VVcmwgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkFyZ3VtZW50RXhjZXB0aW9uKCdiYXNlVXJsJywgYmFzZVVybCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh1cmwgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxPcGVyYXRpb25FeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnSW1hZ2Ugd2FzIGFscmVhZHkgb3BlbmVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHVybCA9IGJhc2VVcmw7XHJcbiAgICAgICAgY3JlYXRlSW50ZXJuYWxTZXNzaW9uKCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmNsb3NlID0gZnVuY3Rpb24gY2xvc2UoY2xvc2VkQ2FsbGJhY2spIHtcclxuICAgICAgICBpZiAobGFzdENsb3NlZENhbGxiYWNrICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKCdjbG9zZWQgdHdpY2UnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGFzdENsb3NlZENhbGxiYWNrID0gY2xvc2VkQ2FsbGJhY2s7XHJcbiAgICAgICAgd2FpdGluZ0ZvckNsb3NlU2Vzc2lvbnMgPSAxO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNsb3NlSW50ZXJuYWxTZXNzaW9uKGFjdGl2ZVNlc3Npb24pO1xyXG4gICAgICAgIGNsb3NlSW50ZXJuYWxTZXNzaW9uKHNlc3Npb25XYWl0aW5nRm9yUmVhZHkpO1xyXG4gICAgICAgIGNsb3NlSW50ZXJuYWxTZXNzaW9uKHNlc3Npb25XYWl0aW5nRm9yRGlzY29ubmVjdCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY2hlY2tJZkFsbFNlc3Npb25zQ2xvc2VkQWZ0ZXJTZXNzaW9uQ2xvc2VkKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0U3RhdHVzQ2FsbGJhY2sgPSBmdW5jdGlvbiBzZXRTdGF0dXNDYWxsYmFjayhuZXdTdGF0dXNDYWxsYmFjaykge1xyXG4gICAgICAgIHN0YXR1c0NhbGxiYWNrID0gbmV3U3RhdHVzQ2FsbGJhY2s7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGFjdGl2ZVNlc3Npb24gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgYWN0aXZlU2Vzc2lvbi5zZXRTdGF0dXNDYWxsYmFjayhuZXdTdGF0dXNDYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5kZWRpY2F0ZUNoYW5uZWxGb3JNb3ZhYmxlUmVxdWVzdCA9XHJcbiAgICAgICAgZnVuY3Rpb24gZGVkaWNhdGVDaGFubmVsRm9yTW92YWJsZVJlcXVlc3QoKSB7XHJcblxyXG4gICAgICAgIGNoZWNrUmVhZHkoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSA9IHsgaW50ZXJuYWxEZWRpY2F0ZWRDaGFubmVsOiBudWxsIH07XHJcbiAgICAgICAgZGVkaWNhdGVkQ2hhbm5lbHMucHVzaChkZWRpY2F0ZWRDaGFubmVsSGFuZGxlKTtcclxuICAgICAgICBjcmVhdGVJbnRlcm5hbERlZGljYXRlZENoYW5uZWwoZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRlZGljYXRlZENoYW5uZWxIYW5kbGU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnJlcXVlc3REYXRhID0gZnVuY3Rpb24gcmVxdWVzdERhdGEoXHJcbiAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgY2FsbGJhY2ssXHJcbiAgICAgICAgZmFpbHVyZUNhbGxiYWNrLFxyXG4gICAgICAgIG51bVF1YWxpdHlMYXllcnMsXHJcbiAgICAgICAgZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZVRvTW92ZSkge1xyXG5cclxuICAgICAgICBjaGVja1JlYWR5KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlcXVlc3QgPSB7XHJcbiAgICAgICAgICAgIGlzRW5kZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICBpbnRlcm5hbFJlcXVlc3Q6IG51bGwsXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtczogY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcclxuICAgICAgICAgICAgZmFpbHVyZUNhbGxiYWNrOiBmYWlsdXJlQ2FsbGJhY2ssXHJcbiAgICAgICAgICAgIG51bVF1YWxpdHlMYXllcnM6IG51bVF1YWxpdHlMYXllcnNcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY2hhbm5lbDtcclxuICAgICAgICB2YXIgbW92ZURlZGljYXRlZENoYW5uZWwgPSAhIWRlZGljYXRlZENoYW5uZWxIYW5kbGVUb01vdmU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1vdmVEZWRpY2F0ZWRDaGFubmVsKSB7XHJcbiAgICAgICAgICAgIGNoYW5uZWwgPSBkZWRpY2F0ZWRDaGFubmVsSGFuZGxlVG9Nb3ZlLmludGVybmFsRGVkaWNhdGVkQ2hhbm5lbDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjaGFubmVsID0gYWN0aXZlU2Vzc2lvbi50cnlHZXRDaGFubmVsKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoY2hhbm5lbCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgbm9uRGVkaWNhdGVkUmVxdWVzdHNXYWl0aW5nRm9yU2VuZC5wdXNoKHJlcXVlc3QpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hhbm5lbC5nZXRJc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0KCkpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdFeHBlY3RlZCBub24tbW92YWJsZSBjaGFubmVsJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNoYW5uZWwuZ2V0SXNEZWRpY2F0ZWRGb3JNb3ZhYmxlUmVxdWVzdCgpICE9PSBtb3ZlRGVkaWNhdGVkQ2hhbm5lbCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdnZXRJc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0IGluY29uc2lzdGVuY3knKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlcXVlc3QuaW50ZXJuYWxSZXF1ZXN0ID0gY2hhbm5lbC5yZXF1ZXN0RGF0YShcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrLFxyXG4gICAgICAgICAgICBmYWlsdXJlQ2FsbGJhY2ssXHJcbiAgICAgICAgICAgIG51bVF1YWxpdHlMYXllcnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVxdWVzdDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc3RvcFJlcXVlc3RBc3luYyA9IGZ1bmN0aW9uIHN0b3BSZXF1ZXN0QXN5bmMocmVxdWVzdCkge1xyXG4gICAgICAgIHJlcXVlc3QuaXNFbmRlZCA9IHRydWU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHJlcXVlc3QuaW50ZXJuYWxSZXF1ZXN0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJlcXVlc3QuaW50ZXJuYWxSZXF1ZXN0LnN0b3BSZXF1ZXN0QXN5bmMoKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnJlY29ubmVjdCA9IHJlY29ubmVjdDtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcmVjb25uZWN0KCkge1xyXG4gICAgICAgIGlmIChzZXNzaW9uV2FpdGluZ0ZvclJlYWR5ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1ByZXZpb3VzIHNlc3Npb24gc3RpbGwgbm90IGVzdGFibGlzaGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChzZXNzaW9uV2FpdGluZ0ZvckRpc2Nvbm5lY3QgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgaWYgKHN0YXR1c0NhbGxiYWNrICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXNDYWxsYmFjayh7XHJcbiAgICAgICAgICAgICAgICAgICAgaXNSZWFkeTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBleGNlcHRpb246IC8vanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1ByZXZpb3VzIHNlc3Npb24gdGhhdCBzaG91bGQgYmUgY2xvc2VkIHN0aWxsIGFsaXZlLicgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnTWF5YmUgb2xkIHJlcXVlc3RDb250ZXh0cyBoYXZlIG5vdCBiZWVkIGNsb3NlZC4gJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdSZWNvbm5lY3Qgd2lsbCBub3QgYmUgZG9uZScgLy8pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGRhdGFiaW5zU2F2ZXIuY2xlYW51cFVucmVnaXN0ZXJlZERhdGFiaW5zKCk7XHJcbiAgICAgICAgY3JlYXRlSW50ZXJuYWxTZXNzaW9uKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUludGVybmFsU2Vzc2lvbigpIHtcclxuICAgICAgICB2YXIgdGFyZ2V0SWQ7XHJcbiAgICAgICAgaWYgKGFjdGl2ZVNlc3Npb24gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGFyZ2V0SWQgPSBhY3RpdmVTZXNzaW9uLmdldFRhcmdldElkKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHNlc3Npb25XYWl0aW5nRm9yUmVhZHkgPSBqcGlwRmFjdG9yeS5jcmVhdGVTZXNzaW9uKFxyXG4gICAgICAgICAgICBtYXhDaGFubmVsc0luU2Vzc2lvbixcclxuICAgICAgICAgICAgbWF4UmVxdWVzdHNXYWl0aW5nRm9yUmVzcG9uc2VJbkNoYW5uZWwsXHJcbiAgICAgICAgICAgIHRhcmdldElkLFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgICAgICAgICBkYXRhYmluc1NhdmVyKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgc2Vzc2lvbldhaXRpbmdGb3JSZWFkeS5zZXRTdGF0dXNDYWxsYmFjayh3YWl0aW5nRm9yUmVhZHlDYWxsYmFjayk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2Vzc2lvbldhaXRpbmdGb3JSZWFkeS5vcGVuKHVybCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUludGVybmFsRGVkaWNhdGVkQ2hhbm5lbChkZWRpY2F0ZWRDaGFubmVsSGFuZGxlKSB7XHJcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBhY3RpdmVTZXNzaW9uLnRyeUdldENoYW5uZWwoXHJcbiAgICAgICAgICAgIC8qZGVkaWNhdGVGb3JNb3ZhYmxlUmVxdWVzdD0qL3RydWUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjaGFubmVsID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsT3BlcmF0aW9uRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1RvbyBtYW55IGNvbmN1cnJlbnQgcmVxdWVzdHMuIExpbWl0IHRoZSB1c2Ugb2YgZGVkaWNhdGVkICcgK1xyXG4gICAgICAgICAgICAgICAgJyhtb3ZhYmxlKSByZXF1ZXN0cywgZW5sYXJnZSBtYXhDaGFubmVsc0luU2Vzc2lvbiBvciB3YWl0ICcgK1xyXG4gICAgICAgICAgICAgICAgJ2ZvciByZXF1ZXN0cyB0byBmaW5pc2ggYW5kIGF2b2lkIGNyZWF0ZSBuZXcgb25lcycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoIWNoYW5uZWwuZ2V0SXNEZWRpY2F0ZWRGb3JNb3ZhYmxlUmVxdWVzdCgpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ2dldElzRGVkaWNhdGVkRm9yTW92YWJsZVJlcXVlc3QgaW5jb25zaXN0ZW5jeScpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGVkaWNhdGVkQ2hhbm5lbEhhbmRsZS5pbnRlcm5hbERlZGljYXRlZENoYW5uZWwgPSBjaGFubmVsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiB3YWl0aW5nRm9yUmVhZHlDYWxsYmFjayhzdGF0dXMpIHtcclxuICAgICAgICBpZiAoc2Vzc2lvbldhaXRpbmdGb3JSZWFkeSA9PT0gbnVsbCB8fFxyXG4gICAgICAgICAgICBzdGF0dXMuaXNSZWFkeSAhPT0gc2Vzc2lvbldhaXRpbmdGb3JSZWFkeS5nZXRJc1JlYWR5KCkpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKCdVbmV4cGVjdGVkICcgK1xyXG4gICAgICAgICAgICAgICAgJ3N0YXR1c0NhbGxiYWNrIHdoZW4gbm90IHJlZ2lzdGVyZWQgdG8gc2Vzc2lvbiBvciAnICtcclxuICAgICAgICAgICAgICAgICdpbmNvbnNpc3RlbnQgaXNSZWFkeScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoc3RhdHVzLmlzUmVhZHkpIHtcclxuICAgICAgICAgICAgaWYgKHNlc3Npb25XYWl0aW5nRm9yRGlzY29ubmVjdCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ3Nlc3Npb25XYWl0aW5nRm9yRGlzY29ubmVjdCBzaG91bGQgYmUgbnVsbCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzZXNzaW9uV2FpdGluZ0ZvckRpc2Nvbm5lY3QgPSBhY3RpdmVTZXNzaW9uO1xyXG4gICAgICAgICAgICBhY3RpdmVTZXNzaW9uID0gc2Vzc2lvbldhaXRpbmdGb3JSZWFkeTtcclxuICAgICAgICAgICAgc2Vzc2lvbldhaXRpbmdGb3JSZWFkeSA9IG51bGw7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc2Vzc2lvbldhaXRpbmdGb3JEaXNjb25uZWN0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uV2FpdGluZ0ZvckRpc2Nvbm5lY3Quc2V0U3RhdHVzQ2FsbGJhY2sobnVsbCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRyeURpc2Nvbm5lY3RXYWl0aW5nU2Vzc2lvbigpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbldhaXRpbmdGb3JEaXNjb25uZWN0LnNldFJlcXVlc3RFbmRlZENhbGxiYWNrKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnlEaXNjb25uZWN0V2FpdGluZ1Nlc3Npb24pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhY3RpdmVTZXNzaW9uLnNldFN0YXR1c0NhbGxiYWNrKHN0YXR1c0NhbGxiYWNrKTtcclxuICAgICAgICAgICAgYWN0aXZlU2Vzc2lvbi5zZXRSZXF1ZXN0RW5kZWRDYWxsYmFjayhhY3RpdmVTZXNzaW9uUmVxdWVzdEVuZGVkQ2FsbGJhY2spO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZWRpY2F0ZWRDaGFubmVscy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgY3JlYXRlSW50ZXJuYWxEZWRpY2F0ZWRDaGFubmVsKGRlZGljYXRlZENoYW5uZWxzW2ldKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoc3RhdHVzQ2FsbGJhY2sgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgc3RhdHVzQ2FsbGJhY2soc3RhdHVzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNsb3NlSW50ZXJuYWxTZXNzaW9uKHNlc3Npb24pIHtcclxuICAgICAgICBpZiAoc2Vzc2lvbiAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICArK3dhaXRpbmdGb3JDbG9zZVNlc3Npb25zO1xyXG4gICAgICAgICAgICBzZXNzaW9uLmNsb3NlKGNoZWNrSWZBbGxTZXNzaW9uc0Nsb3NlZEFmdGVyU2Vzc2lvbkNsb3NlZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjaGVja0lmQWxsU2Vzc2lvbnNDbG9zZWRBZnRlclNlc3Npb25DbG9zZWQoKSB7XHJcbiAgICAgICAgLS13YWl0aW5nRm9yQ2xvc2VTZXNzaW9ucztcclxuICAgICAgICBcclxuICAgICAgICBpZiAod2FpdGluZ0ZvckNsb3NlU2Vzc2lvbnMgPT09IDAgJiYgbGFzdENsb3NlZENhbGxiYWNrICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgbGFzdENsb3NlZENhbGxiYWNrKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjaGVja1JlYWR5KCkge1xyXG4gICAgICAgIGlmIChhY3RpdmVTZXNzaW9uID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKCdUaGlzIG9wZXJhdGlvbiAnICtcclxuICAgICAgICAgICAgICAgICdpcyBmb3JiaWRkZW4gd2hlbiBzZXNzaW9uIGlzIG5vdCByZWFkeScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWN0aXZlU2Vzc2lvblJlcXVlc3RFbmRlZENhbGxiYWNrKGNoYW5uZWxGcmVlZCkge1xyXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoZGF0YWJpbnNTYXZlci5nZXRMb2FkZWRCeXRlcygpID4gbWF4SnBpcENhY2hlU2l6ZSkge1xyXG4gICAgICAgICAgICByZWNvbm5lY3QoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNoYW5uZWxGcmVlZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjaGFubmVsRnJlZWQuZ2V0SXNEZWRpY2F0ZWRGb3JNb3ZhYmxlUmVxdWVzdCgpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ0V4cGVjdGVkIG5vbi1tb3ZhYmxlIGNoYW5uZWwgYXMgY2hhbm5lbEZyZWVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgaWYgKG5vbkRlZGljYXRlZFJlcXVlc3RzV2FpdGluZ0ZvclNlbmQubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXF1ZXN0ID0gbm9uRGVkaWNhdGVkUmVxdWVzdHNXYWl0aW5nRm9yU2VuZC5zaGlmdCgpO1xyXG4gICAgICAgICAgICBpZiAocmVxdWVzdC5pbnRlcm5hbFJlcXVlc3QgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKCdSZXF1ZXN0IHdhcyAnICtcclxuICAgICAgICAgICAgICAgICAgICAnYWxyZWFkeSBzZW50IGJ1dCBzdGlsbCBpbiBxdWV1ZScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSB3aGlsZSAocmVxdWVzdC5pc0VuZGVkKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAocmVxdWVzdCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXF1ZXN0LmludGVybmFsUmVxdWVzdCA9IGNoYW5uZWxGcmVlZC5yZXF1ZXN0RGF0YShcclxuICAgICAgICAgICAgICAgIHJlcXVlc3QuY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0LmNhbGxiYWNrLFxyXG4gICAgICAgICAgICAgICAgcmVxdWVzdC5mYWlsdXJlQ2FsbGJhY2ssXHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0Lm51bVF1YWxpdHlMYXllcnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gdHJ5RGlzY29ubmVjdFdhaXRpbmdTZXNzaW9uKCkge1xyXG4gICAgICAgIHZhciBjYW5DbG9zZVNlc3Npb24gPSAhc2Vzc2lvbldhaXRpbmdGb3JEaXNjb25uZWN0Lmhhc0FjdGl2ZVJlcXVlc3RzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNhbkNsb3NlU2Vzc2lvbikge1xyXG4gICAgICAgICAgICBzZXNzaW9uV2FpdGluZ0ZvckRpc2Nvbm5lY3QuY2xvc2UoKTtcclxuICAgICAgICAgICAgc2Vzc2lvbldhaXRpbmdGb3JEaXNjb25uZWN0ID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGNhbkNsb3NlU2Vzc2lvbjtcclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBSZXF1ZXN0KFxyXG4gICAgc2Vzc2lvbkhlbHBlcixcclxuICAgIG1lc3NhZ2VIZWFkZXJQYXJzZXIsXHJcbiAgICBjaGFubmVsLFxyXG4gICAgcmVxdWVzdFVybCxcclxuICAgIGNhbGxiYWNrLFxyXG4gICAgZmFpbHVyZUNhbGxiYWNrKSB7XHJcbiAgICBcclxuICAgIHZhciBLQiA9IDEwMjQ7XHJcbiAgICB2YXIgUFJPR1JFU1NJVkVORVNTX01JTl9MRU5HVEhfQllURVMgPSAxMCAqIEtCO1xyXG5cclxuICAgIHZhciBSRVNQT05TRV9FTkRFRF9TVUNDRVNTID0gMTtcclxuICAgIHZhciBSRVNQT05TRV9FTkRFRF9BQk9SVEVEID0gMjtcclxuICAgIHZhciBSRVNQT05TRV9FTkRFRF9TRU5UX0FOT1RIRVJfTUVTU0FHRSA9IDM7XHJcbiAgICBcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHZhciBpc0FjdGl2ZSA9IGZhbHNlO1xyXG4gICAgdmFyIGVuZGVkQnlVc2VyID0gZmFsc2U7XHJcbiAgICB2YXIgbGFzdFJlcXVlc3RJZDtcclxuICAgIHZhciByZXNwb25zZUxlbmd0aCA9IFBST0dSRVNTSVZFTkVTU19NSU5fTEVOR1RIX0JZVEVTO1xyXG4gICAgXHJcbiAgICB0aGlzLnN0YXJ0UmVxdWVzdCA9IGZ1bmN0aW9uIHN0YXJ0UmVxdWVzdCgpIHtcclxuICAgICAgICBpZiAoaXNBY3RpdmUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnc3RhcnRSZXF1ZXN0IGNhbGxlZCB0d2ljZScpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoZW5kZWRCeVVzZXIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAncmVxdWVzdCB3YXMgYWxyZWFkeSBzdG9wcGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlzQWN0aXZlID0gdHJ1ZTtcclxuICAgICAgICBzZXNzaW9uSGVscGVyLnJlcXVlc3RTdGFydGVkKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2VuZE1lc3NhZ2VPZkRhdGFSZXF1ZXN0KCk7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc3RvcFJlcXVlc3RBc3luYyA9IGZ1bmN0aW9uIHN0b3BSZXF1ZXN0QXN5bmMocmVxdWVzdCkge1xyXG4gICAgICAgIGVuZGVkQnlVc2VyID0gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0TGFzdFJlcXVlc3RJZCA9IGZ1bmN0aW9uIGdldExhc3RSZXF1ZXN0SWQoKSB7XHJcbiAgICAgICAgaWYgKCFpc0FjdGl2ZSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdVbmV4cGVjdGVkIGNhbGwgdG8gZ2V0TGFzdFJlcXVlc3RJZCBvbiBpbmFjdGl2ZSByZXF1ZXN0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBsYXN0UmVxdWVzdElkO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5jYWxsQ2FsbGJhY2tBZnRlckNvbmN1cnJlbnRSZXF1ZXN0c0ZpbmlzaGVkID1cclxuICAgICAgICBmdW5jdGlvbiBjYWxsQ2FsbGJhY2tBZnRlckNvbmN1cnJlbnRSZXF1ZXN0c0ZpbmlzaGVkKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNhbGxiYWNrKHNlbGYsIC8qaXNSZXNwb25zZURvbmU9Ki90cnVlKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGludGVybmFsU3VjY2Vzc0NhbGxiYWNrKGFqYXhSZXNwb25zZSwgaXNSZXNwb25zZURvbmUpIHtcclxuICAgICAgICB2YXIgZmFpbGVkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHZhciBlbmRlZFJlYXNvbiA9IHByb2Nlc3NBamF4UmVzcG9uc2UoYWpheFJlc3BvbnNlLCBpc1Jlc3BvbnNlRG9uZSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoZW5kZWRSZWFzb24gPT09IFJFU1BPTlNFX0VOREVEX1NFTlRfQU5PVEhFUl9NRVNTQUdFKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZhaWxlZCA9IGVuZGVkUmVhc29uID09PSBSRVNQT05TRV9FTkRFRF9BQk9SVEVEO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgZmFpbGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgc2Vzc2lvbkhlbHBlci5vbkV4Y2VwdGlvbihlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFmYWlsZWQpIHtcclxuICAgICAgICAgICAgICAgIHNlc3Npb25IZWxwZXIud2FpdEZvckNvbmN1cnJlbnRSZXF1ZXN0c1RvRW5kKHNlbGYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjaGFubmVsLnJlcXVlc3RFbmRlZChhamF4UmVzcG9uc2UsIHNlbGYpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGZhaWxlZCAmJiAhZW5kZWRCeVVzZXIgJiYgZmFpbHVyZUNhbGxiYWNrICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGZhaWx1cmVDYWxsYmFjaygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzZXNzaW9uSGVscGVyLmNoZWNrQ29uY3VycmVudFJlcXVlc3RzRmluaXNoZWQoKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIHNlc3Npb25IZWxwZXIub25FeGNlcHRpb24oZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBpbnRlcm5hbEZhaWx1cmVDYWxsYmFjayhhamF4UmVzcG9uc2UpIHtcclxuICAgICAgICBjaGFubmVsLnJlcXVlc3RFbmRlZChhamF4UmVzcG9uc2UsIHNlbGYpO1xyXG4gICAgICAgIHNlc3Npb25IZWxwZXIuY2hlY2tDb25jdXJyZW50UmVxdWVzdHNGaW5pc2hlZCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChmYWlsdXJlQ2FsbGJhY2sgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBmYWlsdXJlQ2FsbGJhY2soKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHByb2Nlc3NBamF4UmVzcG9uc2UoYWpheFJlc3BvbnNlLCBpc1Jlc3BvbnNlRG9uZSkge1xyXG4gICAgICAgIGlmICghaXNSZXNwb25zZURvbmUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oJ0FKQVggJyArXHJcbiAgICAgICAgICAgICAgICAnY2FsbGJhY2sgY2FsbGVkIGFsdGhvdWdoIHJlc3BvbnNlIGlzIG5vdCBkb25lIHlldCAnICtcclxuICAgICAgICAgICAgICAgICdhbmQgY2h1bmtlZCBlbmNvZGluZyBpcyBub3QgZW5hYmxlZCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHZhciBjcmVhdGVkQ2hhbm5lbCA9IHNlc3Npb25IZWxwZXIuZ2V0Q3JlYXRlZENoYW5uZWxJZChcclxuICAgICAgICAgICAgYWpheFJlc3BvbnNlKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoY3JlYXRlZENoYW5uZWwgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgaWYgKGNoYW5uZWwuZ2V0Q2hhbm5lbElkKCkgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHNlc3Npb25IZWxwZXIub25FeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxEYXRhRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ2hhbm5lbCBjcmVhdGVkIGFsdGhvdWdoIHdhcyBub3QgcmVxdWVzdGVkJywgJ0QuMi4zJykpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY2hhbm5lbC5zZXRDaGFubmVsSWQoY3JlYXRlZENoYW5uZWwpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmIChjaGFubmVsLmdldENoYW5uZWxJZCgpID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNlc3Npb25IZWxwZXIub25FeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ0Nhbm5vdCBleHRyYWN0IGNpZCBmcm9tIGNuZXcgcmVzcG9uc2UnLCAnRC4yLjMnKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBlbmRPZmZzZXQgPSBzYXZlVG9EYXRhYmluc0Zyb21PZmZzZXQoYWpheFJlc3BvbnNlKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoZW5kT2Zmc2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBSRVNQT05TRV9FTkRFRF9BQk9SVEVEO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgZW5kZWRSZWFzb24gPSBwYXJzZUVuZE9mUmVzcG9uc2UoYWpheFJlc3BvbnNlLCBlbmRPZmZzZXQpO1xyXG4gICAgICAgIHJldHVybiBlbmRlZFJlYXNvbjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2VuZE1lc3NhZ2VPZkRhdGFSZXF1ZXN0KCkge1xyXG4gICAgICAgIGxhc3RSZXF1ZXN0SWQgPSBjaGFubmVsLm5leHRSZXF1ZXN0SWQoKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgdXJsID0gcmVxdWVzdFVybCArXHJcbiAgICAgICAgICAgICcmbGVuPScgKyByZXNwb25zZUxlbmd0aCArXHJcbiAgICAgICAgICAgICcmcWlkPScgKyBsYXN0UmVxdWVzdElkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJlc3BvbnNlTGVuZ3RoICo9IDI7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNob3VsZENyZWF0ZUNoYW5uZWwgPSBjaGFubmVsLmdldENoYW5uZWxJZCgpID09PSBudWxsO1xyXG4gICAgICAgIGlmIChzaG91bGRDcmVhdGVDaGFubmVsKSB7XHJcbiAgICAgICAgICAgIHVybCArPSAnJmNuZXc9aHR0cCc7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgZXhpc3RDaGFubmVsSW5TZXNzaW9uID0gc2Vzc2lvbkhlbHBlci5nZXRGaXJzdENoYW5uZWwoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoZXhpc3RDaGFubmVsSW5TZXNzaW9uICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICB1cmwgKz0gJyZjaWQ9JyArIGV4aXN0Q2hhbm5lbEluU2Vzc2lvbi5nZXRDaGFubmVsSWQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gTk9URTogSWYgZXhpc3RDaGFubmVsSW5TZXNzaW9uLCBtYXliZSBzaG91bGQgcmVtb3ZlIFwiJnN0cmVhbT0wXCJcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB1cmwgKz0gJyZjaWQ9JyArIGNoYW5uZWwuZ2V0Q2hhbm5lbElkKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHNlc3Npb25IZWxwZXIuc2VuZEFqYXgoXHJcbiAgICAgICAgICAgIHVybCxcclxuICAgICAgICAgICAgaW50ZXJuYWxTdWNjZXNzQ2FsbGJhY2ssXHJcbiAgICAgICAgICAgIGludGVybmFsRmFpbHVyZUNhbGxiYWNrKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcGFyc2VFbmRPZlJlc3BvbnNlKGFqYXhSZXNwb25zZSwgb2Zmc2V0KSB7XHJcbiAgICAgICAgdmFyIGVuZFJlc3BvbnNlUmVzdWx0ID0gUkVTUE9OU0VfRU5ERURfQUJPUlRFRDtcclxuICAgICAgICB2YXIgYnl0ZXMgPSBuZXcgVWludDhBcnJheShhamF4UmVzcG9uc2UucmVzcG9uc2UpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChvZmZzZXQgPiBieXRlcy5sZW5ndGggLSAyIHx8XHJcbiAgICAgICAgICAgIGJ5dGVzW29mZnNldF0gIT09IDApIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbignQ291bGQgbm90IGZpbmQgJyArXHJcbiAgICAgICAgICAgICAgICAnRW5kIE9mIFJlc3BvbnNlIChFT1IpIGNvZGUgYXQgdGhlIGVuZCBvZiByZXNwb25zZScsICdELjMnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChieXRlc1tvZmZzZXQgKyAxXSkge1xyXG4gICAgICAgICAgICBjYXNlIGpHbG9iYWxzLmpwaXBFbmRPZlJlc3BvbnNlUmVhc29ucy5JTUFHRV9ET05FOlxyXG4gICAgICAgICAgICBjYXNlIGpHbG9iYWxzLmpwaXBFbmRPZlJlc3BvbnNlUmVhc29ucy5XSU5ET1dfRE9ORTpcclxuICAgICAgICAgICAgY2FzZSBqR2xvYmFscy5qcGlwRW5kT2ZSZXNwb25zZVJlYXNvbnMuUVVBTElUWV9MSU1JVDpcclxuICAgICAgICAgICAgICAgIGVuZFJlc3BvbnNlUmVzdWx0ID0gUkVTUE9OU0VfRU5ERURfU1VDQ0VTUztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSBqR2xvYmFscy5qcGlwRW5kT2ZSZXNwb25zZVJlYXNvbnMuV0lORE9XX0NIQU5HRTpcclxuICAgICAgICAgICAgICAgIGlmICghZW5kZWRCeVVzZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1NlcnZlciByZXNwb25zZSB3YXMgdGVybWluYXRlZCBkdWUgdG8gbmV3ZXIgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdyZXF1ZXN0IGlzc3VlZCBvbiBzYW1lIGNoYW5uZWwuIFRoYXQgbWF5IGJlIGFuICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnaW50ZXJuYWwgd2VianBpcC5qcyBlcnJvciAtIENoZWNrIHRoYXQgbW92YWJsZSAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3JlcXVlc3RzIGFyZSB3ZWxsIG1haW50YWluZWQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSBqR2xvYmFscy5qcGlwRW5kT2ZSZXNwb25zZVJlYXNvbnMuQllURV9MSU1JVDpcclxuICAgICAgICAgICAgY2FzZSBqR2xvYmFscy5qcGlwRW5kT2ZSZXNwb25zZVJlYXNvbnMuUkVTUE9OU0VfTElNSVQ6XHJcbiAgICAgICAgICAgICAgICBpZiAoIWVuZGVkQnlVc2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VuZE1lc3NhZ2VPZkRhdGFSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZW5kUmVzcG9uc2VSZXN1bHQgPSBSRVNQT05TRV9FTkRFRF9TRU5UX0FOT1RIRVJfTUVTU0FHRTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlIGpHbG9iYWxzLmpwaXBFbmRPZlJlc3BvbnNlUmVhc29ucy5TRVNTSU9OX0xJTUlUOlxyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbkhlbHBlci5vbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbE9wZXJhdGlvbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1NlcnZlciByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBzZXNzaW9uIGlzICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbGltaXR0ZWQsIG5vIGZ1cnRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIGlzc3VlZCB0byAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoaXMgc2Vzc2lvbicpKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSBqR2xvYmFscy5qcGlwRW5kT2ZSZXNwb25zZVJlYXNvbnMuTk9OX1NQRUNJRklFRDpcclxuICAgICAgICAgICAgICAgIHNlc3Npb25IZWxwZXIub25FeGNlcHRpb24obmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxPcGVyYXRpb25FeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1NlcnZlciBlcnJvciB0ZXJtaW5hdGVkIHJlc3BvbnNlIHdpdGggbm8gcmVhc29uIHNwZWNpZmllZCcpKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbkhlbHBlci5vbkV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdTZXJ2ZXIgcmVzcG9uZGVkIHdpdGggaWxsZWdhbCBFbmQgT2YgUmVzcG9uc2UgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICcoRU9SKSBjb2RlOiAnICsgYnl0ZXNbb2Zmc2V0ICsgMV0pKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZW5kUmVzcG9uc2VSZXN1bHQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHNhdmVUb0RhdGFiaW5zRnJvbU9mZnNldChhamF4UmVzcG9uc2UpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB2YXIgYnl0ZXMgPSBuZXcgVWludDhBcnJheShhamF4UmVzcG9uc2UucmVzcG9uc2UpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG9mZnNldCA9IDA7XHJcbiAgICAgICAgICAgIHZhciBwcmV2aW91c0hlYWRlcjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHdoaWxlIChvZmZzZXQgPCBieXRlcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChieXRlc1tvZmZzZXRdID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gRW5kIE9mIFJlc3BvbnNlIChFT1IpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBoZWFkZXIgPSBtZXNzYWdlSGVhZGVyUGFyc2VyLnBhcnNlTWVzc2FnZUhlYWRlcihcclxuICAgICAgICAgICAgICAgICAgICBieXRlcywgb2Zmc2V0LCBwcmV2aW91c0hlYWRlcik7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChoZWFkZXIuYm9keVN0YXJ0ICsgaGVhZGVyLm1lc3NhZ2VCb2R5TGVuZ3RoID4gYnl0ZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9mZnNldDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgc2Vzc2lvbkhlbHBlci5nZXREYXRhYmluc1NhdmVyKCkuc2F2ZURhdGEoaGVhZGVyLCBieXRlcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIG9mZnNldCA9IGhlYWRlci5ib2R5U3RhcnQgKyBoZWFkZXIubWVzc2FnZUJvZHlMZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBwcmV2aW91c0hlYWRlciA9IGhlYWRlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIG9mZnNldDtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIHNlc3Npb25IZWxwZXIub25FeGNlcHRpb24oZSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwU2Vzc2lvbkhlbHBlcihcclxuICAgIGRhdGFSZXF1ZXN0VXJsLFxyXG4gICAga25vd25UYXJnZXRJZCxcclxuICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICBkYXRhYmluc1NhdmVyLFxyXG4gICAgYWpheEhlbHBlcikge1xyXG4gICAgXHJcbiAgICB2YXIgc3RhdHVzQ2FsbGJhY2sgPSBudWxsO1xyXG4gICAgdmFyIHJlcXVlc3RFbmRlZENhbGxiYWNrID0gbnVsbDtcclxuICAgIFxyXG4gICAgdmFyIGNoYW5uZWxzID0gW107XHJcbiAgICB2YXIgZmlyc3RDaGFubmVsID0gbnVsbDtcclxuXHJcbiAgICB2YXIgYWN0aXZlUmVxdWVzdHMgPSAwO1xyXG4gICAgdmFyIHdhaXRpbmdGb3JDb25jdXJyZW50UmVxdWVzdHMgPSBbXTtcclxuXHJcbiAgICB2YXIgaXNSZWFkeSA9IGZhbHNlO1xyXG4gICAgdmFyIHRhcmdldElkID0ga25vd25UYXJnZXRJZCB8fCAnMCc7XHJcbiAgICBcclxuICAgIHRoaXMub25FeGNlcHRpb24gPSBmdW5jdGlvbiBvbkV4Y2VwdGlvbihleGNlcHRpb24pIHtcclxuICAgICAgICBvblN0YXR1c0NoYW5nZShleGNlcHRpb24pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRJc1JlYWR5ID0gZnVuY3Rpb24gZ2V0SXNSZWFkeSgpIHtcclxuICAgICAgICByZXR1cm4gaXNSZWFkeTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc2V0SXNSZWFkeSA9IGZ1bmN0aW9uIHNldElzUmVhZHkoaXNSZWFkeV8pIHtcclxuICAgICAgICBpc1JlYWR5ID0gaXNSZWFkeV87XHJcbiAgICAgICAgb25TdGF0dXNDaGFuZ2UoKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Q29kZXN0cmVhbVN0cnVjdHVyZSA9IGZ1bmN0aW9uIGdldENvZGVzdHJlYW1TdHJ1Y3R1cmUoKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvZGVzdHJlYW1TdHJ1Y3R1cmU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldERhdGFiaW5zU2F2ZXIgPSBmdW5jdGlvbiBnZXREYXRhYmluc1NhdmVyKCkge1xyXG4gICAgICAgIHJldHVybiBkYXRhYmluc1NhdmVyO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXREYXRhUmVxdWVzdFVybCA9IGZ1bmN0aW9uIGdldERhdGFSZXF1ZXN0VXJsKCkge1xyXG4gICAgICAgIHJldHVybiBkYXRhUmVxdWVzdFVybDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VGFyZ2V0SWQgPSBmdW5jdGlvbiBnZXRUYXJnZXRJZCgpIHtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0SWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEZpcnN0Q2hhbm5lbCA9IGZ1bmN0aW9uIGdldEZpcnN0Q2hhbm5lbCgpIHtcclxuICAgICAgICByZXR1cm4gZmlyc3RDaGFubmVsO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5zZXRTdGF0dXNDYWxsYmFjayA9IGZ1bmN0aW9uIHNldFN0YXR1c0NhbGxiYWNrKHN0YXR1c0NhbGxiYWNrXykge1xyXG4gICAgICAgIHN0YXR1c0NhbGxiYWNrID0gc3RhdHVzQ2FsbGJhY2tfO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5zZXRSZXF1ZXN0RW5kZWRDYWxsYmFjayA9IGZ1bmN0aW9uIHNldFJlcXVlc3RFbmRlZENhbGxiYWNrKFxyXG4gICAgICAgIHJlcXVlc3RFbmRlZENhbGxiYWNrXykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJlcXVlc3RFbmRlZENhbGxiYWNrID0gcmVxdWVzdEVuZGVkQ2FsbGJhY2tfO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5yZXF1ZXN0U3RhcnRlZCA9IGZ1bmN0aW9uIHJlcXVlc3RTdGFydGVkKCkge1xyXG4gICAgICAgICsrYWN0aXZlUmVxdWVzdHM7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnJlcXVlc3RFbmRlZCA9IGZ1bmN0aW9uIHJlcXVlc3RFbmRlZChhamF4UmVzcG9uc2UsIGNoYW5uZWwpIHtcclxuICAgICAgICAtLWFjdGl2ZVJlcXVlc3RzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0YXJnZXRJZEZyb21TZXJ2ZXIgPSBhamF4UmVzcG9uc2UuZ2V0UmVzcG9uc2VIZWFkZXIoJ0pQSVAtdGlkJyk7XHJcbiAgICAgICAgaWYgKHRhcmdldElkRnJvbVNlcnZlciAhPT0gJycgJiYgdGFyZ2V0SWRGcm9tU2VydmVyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGlmICh0YXJnZXRJZCA9PT0gJzAnKSB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXRJZCA9IHRhcmdldElkRnJvbVNlcnZlcjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXRJZCAhPT0gdGFyZ2V0SWRGcm9tU2VydmVyKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1NlcnZlciByZXR1cm5lZCB1bm1hdGNoZWQgdGFyZ2V0IElEJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGZpcnN0Q2hhbm5lbCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICBmaXJzdENoYW5uZWwgPSBjaGFubmVsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgY2hhbm5lbEZyZWVkID0gY2hhbm5lbC5nZXRJc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0KCkgP1xyXG4gICAgICAgICAgICBudWxsIDogY2hhbm5lbDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAocmVxdWVzdEVuZGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmVxdWVzdEVuZGVkQ2FsbGJhY2soY2hhbm5lbEZyZWVkKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldEFjdGl2ZVJlcXVlc3RzQ291bnQgPSBmdW5jdGlvbiBnZXRBY3RpdmVSZXF1ZXN0c0NvdW50KCkge1xyXG4gICAgICAgIHJldHVybiBhY3RpdmVSZXF1ZXN0cztcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuY2hhbm5lbENyZWF0ZWQgPSBmdW5jdGlvbiBjaGFubmVsQ3JlYXRlZChjaGFubmVsKSB7XHJcbiAgICAgICAgY2hhbm5lbHMucHVzaChjaGFubmVsKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0Q3JlYXRlZENoYW5uZWxJZCA9IGZ1bmN0aW9uIGdldENyZWF0ZWRDaGFubmVsSWQoYWpheFJlc3BvbnNlKSB7XHJcbiAgICAgICAgdmFyIGNuZXdSZXNwb25zZSA9IGFqYXhSZXNwb25zZS5nZXRSZXNwb25zZUhlYWRlcignSlBJUC1jbmV3Jyk7XHJcbiAgICAgICAgaWYgKCFjbmV3UmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBrZXlWYWx1ZVBhaXJzSW5SZXNwb25zZSA9IGNuZXdSZXNwb25zZS5zcGxpdCgnLCcpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleVZhbHVlUGFpcnNJblJlc3BvbnNlLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBrZXlBbmRWYWx1ZSA9IGtleVZhbHVlUGFpcnNJblJlc3BvbnNlW2ldLnNwbGl0KCc9Jyk7XHJcblxyXG4gICAgICAgICAgICBpZiAoa2V5QW5kVmFsdWVbMF0gPT09ICdjaWQnKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ga2V5QW5kVmFsdWVbMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLndhaXRGb3JDb25jdXJyZW50UmVxdWVzdHNUb0VuZCA9XHJcbiAgICAgICAgZnVuY3Rpb24gd2FpdEZvckNvbmN1cnJlbnRSZXF1ZXN0c1RvRW5kKHJlcXVlc3QpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29uY3VycmVudFJlcXVlc3RzID0gW107XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFubmVscy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgcmVxdWVzdHMgPSBjaGFubmVsc1tpXS5nZXRSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZSgpO1xyXG4gICAgICAgICAgICB2YXIgbnVtUmVxdWVzdHMgPSByZXF1ZXN0cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIGlmIChudW1SZXF1ZXN0cyA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBsYXN0UmVxdWVzdElkID0gcmVxdWVzdHNbMF0uZ2V0TGFzdFJlcXVlc3RJZCgpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMTsgaiA8IHJlcXVlc3RzLmxlbmd0aDsgKytqKSB7XHJcbiAgICAgICAgICAgICAgICBsYXN0UmVxdWVzdElkID0gTWF0aC5tYXgoXHJcbiAgICAgICAgICAgICAgICAgICAgbGFzdFJlcXVlc3RJZCwgcmVxdWVzdHNbal0uZ2V0TGFzdFJlcXVlc3RJZCgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uY3VycmVudFJlcXVlc3RzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgY2hhbm5lbDogY2hhbm5lbHNbaV0sXHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0SWQ6IGxhc3RSZXF1ZXN0SWRcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB3YWl0aW5nRm9yQ29uY3VycmVudFJlcXVlc3RzLnB1c2goe1xyXG4gICAgICAgICAgICByZXF1ZXN0OiByZXF1ZXN0LFxyXG4gICAgICAgICAgICBjb25jdXJyZW50UmVxdWVzdHM6IGNvbmN1cnJlbnRSZXF1ZXN0c1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5jaGVja0NvbmN1cnJlbnRSZXF1ZXN0c0ZpbmlzaGVkID1cclxuICAgICAgICBmdW5jdGlvbiBjaGVja0NvbmN1cnJlbnRSZXF1ZXN0c0ZpbmlzaGVkKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAodmFyIGkgPSB3YWl0aW5nRm9yQ29uY3VycmVudFJlcXVlc3RzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XHJcbiAgICAgICAgICAgIHZhciBpc0FsbENvbmN1cnJlbnRSZXF1ZXN0c0ZpbmlzaGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHZhciBjb25jdXJyZW50UmVxdWVzdHMgPVxyXG4gICAgICAgICAgICAgICAgd2FpdGluZ0ZvckNvbmN1cnJlbnRSZXF1ZXN0c1tpXS5jb25jdXJyZW50UmVxdWVzdHM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gY29uY3VycmVudFJlcXVlc3RzLmxlbmd0aCAtIDE7IGogPj0gMDsgLS1qKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgd2FpdGluZyA9IGNvbmN1cnJlbnRSZXF1ZXN0c1tqXTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHdhaXRpbmcuY2hhbm5lbC5pc0FsbE9sZFJlcXVlc3RzRW5kZWQod2FpdGluZy5yZXF1ZXN0SWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uY3VycmVudFJlcXVlc3RzW2pdID0gY29uY3VycmVudFJlcXVlc3RzW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25jdXJyZW50UmVxdWVzdHMubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgICAgICAgICAgICAgY29uY3VycmVudFJlcXVlc3RzLmxlbmd0aCAtPSAxO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoY29uY3VycmVudFJlcXVlc3RzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IHdhaXRpbmdGb3JDb25jdXJyZW50UmVxdWVzdHNbaV0ucmVxdWVzdDtcclxuICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gcmVxdWVzdC5jYWxsYmFjaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHdhaXRpbmdGb3JDb25jdXJyZW50UmVxdWVzdHNbaV0gPSB3YWl0aW5nRm9yQ29uY3VycmVudFJlcXVlc3RzW1xyXG4gICAgICAgICAgICAgICAgd2FpdGluZ0ZvckNvbmN1cnJlbnRSZXF1ZXN0cy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgd2FpdGluZ0ZvckNvbmN1cnJlbnRSZXF1ZXN0cy5sZW5ndGggLT0gMTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJlcXVlc3QuY2FsbENhbGxiYWNrQWZ0ZXJDb25jdXJyZW50UmVxdWVzdHNGaW5pc2hlZCgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc2VuZEFqYXggPSBmdW5jdGlvbiBzZW5kQWpheChcclxuICAgICAgICB1cmwsXHJcbiAgICAgICAgY2FsbGJhY2ssXHJcbiAgICAgICAgZmFpbHVyZUNhbGxiYWNrKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZvcmtlZEZhaWx1cmVDYWxsYmFjaztcclxuICAgICAgICBcclxuICAgICAgICBpZiAoZmFpbHVyZUNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgIGZvcmtlZEZhaWx1cmVDYWxsYmFjayA9IGZ1bmN0aW9uIGZvcmtGYWlsdXJlQ2FsbGJhY2soYWpheFJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICBnZW5lcmFsRmFpbHVyZUNhbGxiYWNrKGFqYXhSZXNwb25zZSk7XHJcbiAgICAgICAgICAgICAgICBmYWlsdXJlQ2FsbGJhY2soYWpheFJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmb3JrZWRGYWlsdXJlQ2FsbGJhY2sgPSBnZW5lcmFsRmFpbHVyZUNhbGxiYWNrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBhamF4SGVscGVyLnJlcXVlc3QodXJsLCBjYWxsYmFjaywgZm9ya2VkRmFpbHVyZUNhbGxiYWNrKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdlbmVyYWxGYWlsdXJlQ2FsbGJhY2soYWpheFJlc3BvbnNlKSB7XHJcbiAgICAgICAgdmFyIGV4Y2VwdGlvbiA9IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAnQmFkIGpwaXAgc2VydmVyIHJlc3BvbnNlIChzdGF0dXMgPSAnICsgYWpheFJlc3BvbnNlLnN0YXR1cyArICcpJyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIG9uU3RhdHVzQ2hhbmdlKGV4Y2VwdGlvbik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIG9uU3RhdHVzQ2hhbmdlKGV4Y2VwdGlvbikge1xyXG4gICAgICAgIGlmIChleGNlcHRpb24gPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBleGNlcHRpb24gPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoc3RhdHVzQ2FsbGJhY2sgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgc3RhdHVzQ2FsbGJhY2soe1xyXG4gICAgICAgICAgICAgICAgaXNSZWFkeTogaXNSZWFkeSxcclxuICAgICAgICAgICAgICAgIGV4Y2VwdGlvbjogZXhjZXB0aW9uXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBTZXNzaW9uKFxyXG4gICAgbWF4Q2hhbm5lbHNJblNlc3Npb24sXHJcbiAgICBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCxcclxuICAgIGtub3duVGFyZ2V0SWQsXHJcbiAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgZGF0YWJpbnNTYXZlcixcclxuICAgIHNldEludGVydmFsRnVuY3Rpb24sXHJcbiAgICBjbGVhckludGVydmFsRnVuY3Rpb24sXHJcbiAgICBqcGlwRmFjdG9yeSkge1xyXG5cclxuICAgIHZhciBTRUNPTkQgPSAxMDAwO1xyXG4gICAgdmFyIEtFRVBfQUxJVkVfSU5URVJWQUwgPSAzMCAqIFNFQ09ORDtcclxuICAgIFxyXG4gICAgdmFyIGNoYW5uZWxNYW5hZ2VtZW50VXJsO1xyXG4gICAgdmFyIGRhdGFSZXF1ZXN0VXJsO1xyXG4gICAgdmFyIGNsb3NlU2Vzc2lvblVybDtcclxuICAgIFxyXG4gICAgdmFyIGlzQ2xvc2VDYWxsZWQgPSBmYWxzZTtcclxuICAgIHZhciBjbG9zZUNhbGxiYWNrUGVuZGluZyA9IG51bGw7XHJcblxyXG4gICAgdmFyIHNlc3Npb25IZWxwZXIgPSBudWxsO1xyXG4gICAgdmFyIHN0YXR1c0NhbGxiYWNrID0gbnVsbDtcclxuICAgIHZhciByZXF1ZXN0RW5kZWRDYWxsYmFjayA9IG51bGw7XHJcblxyXG4gICAgdmFyIG5vbkRlZGljYXRlZENoYW5uZWxzID0gW107XHJcbiAgICB2YXIgY2hhbm5lbHNDcmVhdGVkID0gMDtcclxuICAgIHZhciBrZWVwQWxpdmVJbnRlcnZhbEhhbmRsZSA9IG51bGw7XHJcbiAgICBcclxuICAgIHRoaXMub3BlbiA9IGZ1bmN0aW9uIG9wZW4oYmFzZVVybCkge1xyXG4gICAgICAgIGlmIChzZXNzaW9uSGVscGVyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ3Nlc3Npb24ub3BlbigpIHNob3VsZCBiZSBjYWxsZWQgb25seSBvbmNlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBxdWVyeVBhcmFtc0RlbGltaXRlciA9IGJhc2VVcmwuaW5kZXhPZignPycpIDwgMCA/ICc/JyA6ICcmJztcclxuICAgICAgICBjaGFubmVsTWFuYWdlbWVudFVybCA9IGJhc2VVcmwgKyBxdWVyeVBhcmFtc0RlbGltaXRlciArICd0eXBlPScgKyBcclxuICAgICAgICAgICAgKGRhdGFiaW5zU2F2ZXIuZ2V0SXNKcGlwVGlsZVBhcnRTdHJlYW0oKSA/ICdqcHQtc3RyZWFtJyA6ICdqcHAtc3RyZWFtJyk7XHJcbiAgICAgICAgZGF0YVJlcXVlc3RVcmwgPSBjaGFubmVsTWFuYWdlbWVudFVybCArICcmc3RyZWFtPTAnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHNlc3Npb25IZWxwZXIgPSBqcGlwRmFjdG9yeS5jcmVhdGVTZXNzaW9uSGVscGVyKFxyXG4gICAgICAgICAgICBkYXRhUmVxdWVzdFVybCwga25vd25UYXJnZXRJZCwgY29kZXN0cmVhbVN0cnVjdHVyZSwgZGF0YWJpbnNTYXZlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHN0YXR1c0NhbGxiYWNrICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNlc3Npb25IZWxwZXIuc2V0U3RhdHVzQ2FsbGJhY2soc3RhdHVzQ2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAocmVxdWVzdEVuZGVkQ2FsbGJhY2sgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgc2Vzc2lvbkhlbHBlci5zZXRSZXF1ZXN0RW5kZWRDYWxsYmFjayhyZXF1ZXN0RW5kZWRDYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjaGFubmVsID0gY3JlYXRlQ2hhbm5lbCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNoYW5uZWwuc2VuZE1pbmltYWxSZXF1ZXN0KHNlc3Npb25SZWFkeUNhbGxiYWNrKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VGFyZ2V0SWQgPSBmdW5jdGlvbiBnZXRUYXJnZXRJZCgpIHtcclxuICAgICAgICBlbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIHJldHVybiBzZXNzaW9uSGVscGVyLmdldFRhcmdldElkKCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldElzUmVhZHkgPSBmdW5jdGlvbiBnZXRJc1JlYWR5KCkge1xyXG4gICAgICAgIHZhciBpc1JlYWR5ID0gc2Vzc2lvbkhlbHBlciAhPT0gbnVsbCAmJiBzZXNzaW9uSGVscGVyLmdldElzUmVhZHkoKTtcclxuICAgICAgICByZXR1cm4gaXNSZWFkeTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc2V0U3RhdHVzQ2FsbGJhY2sgPSBmdW5jdGlvbiBzZXRTdGF0dXNDYWxsYmFjayhzdGF0dXNDYWxsYmFja18pIHtcclxuICAgICAgICBzdGF0dXNDYWxsYmFjayA9IHN0YXR1c0NhbGxiYWNrXztcclxuICAgICAgICBcclxuICAgICAgICBpZiAoc2Vzc2lvbkhlbHBlciAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBzZXNzaW9uSGVscGVyLnNldFN0YXR1c0NhbGxiYWNrKHN0YXR1c0NhbGxiYWNrXyk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5zZXRSZXF1ZXN0RW5kZWRDYWxsYmFjayA9IGZ1bmN0aW9uIHNldFJlcXVlc3RFbmRlZENhbGxiYWNrKFxyXG4gICAgICAgIHJlcXVlc3RFbmRlZENhbGxiYWNrXykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJlcXVlc3RFbmRlZENhbGxiYWNrID0gcmVxdWVzdEVuZGVkQ2FsbGJhY2tfO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChzZXNzaW9uSGVscGVyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNlc3Npb25IZWxwZXIuc2V0UmVxdWVzdEVuZGVkQ2FsbGJhY2socmVxdWVzdEVuZGVkQ2FsbGJhY2tfKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmhhc0FjdGl2ZVJlcXVlc3RzID0gZnVuY3Rpb24gaGFzQWN0aXZlUmVxdWVzdHMoKSB7XHJcbiAgICAgICAgZW5zdXJlUmVhZHkoKTtcclxuXHJcbiAgICAgICAgdmFyIGlzQWN0aXZlUmVxdWVzdHMgPSBzZXNzaW9uSGVscGVyLmdldEFjdGl2ZVJlcXVlc3RzQ291bnQoKSA+IDA7XHJcbiAgICAgICAgcmV0dXJuIGlzQWN0aXZlUmVxdWVzdHM7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnRyeUdldENoYW5uZWwgPSBmdW5jdGlvbiB0cnlHZXRDaGFubmVsKGRlZGljYXRlRm9yTW92YWJsZVJlcXVlc3QpIHtcclxuICAgICAgICBlbnN1cmVSZWFkeSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjYW5DcmVhdGVOZXdDaGFubmVsID0gY2hhbm5lbHNDcmVhdGVkIDwgbWF4Q2hhbm5lbHNJblNlc3Npb247XHJcbiAgICAgICAgdmFyIHNlYXJjaE9ubHlDaGFubmVsV2l0aEVtcHR5UXVldWUgPVxyXG4gICAgICAgICAgICBjYW5DcmVhdGVOZXdDaGFubmVsIHx8IGRlZGljYXRlRm9yTW92YWJsZVJlcXVlc3Q7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1heFJlcXVlc3RzSW5DaGFubmVsID0gc2VhcmNoT25seUNoYW5uZWxXaXRoRW1wdHlRdWV1ZSA/XHJcbiAgICAgICAgICAgIDAgOiBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCAtIDE7XHJcblxyXG4gICAgICAgIHZhciBjaGFubmVsID0gZ2V0Q2hhbm5lbFdpdGhNaW5pbWFsV2FpdGluZ1JlcXVlc3RzKFxyXG4gICAgICAgICAgICBtYXhSZXF1ZXN0c0luQ2hhbm5lbCxcclxuICAgICAgICAgICAgLyppc0V4dHJhY3RGcm9tTm9uRGVkaWNhdGVkTGlzdD0qL2RlZGljYXRlRm9yTW92YWJsZVJlcXVlc3QpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjaGFubmVsID09PSBudWxsICYmIGNhbkNyZWF0ZU5ld0NoYW5uZWwpIHtcclxuICAgICAgICAgICAgY2hhbm5lbCA9IGNyZWF0ZUNoYW5uZWwoZGVkaWNhdGVGb3JNb3ZhYmxlUmVxdWVzdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChkZWRpY2F0ZUZvck1vdmFibGVSZXF1ZXN0ICYmIGNoYW5uZWwgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgY2hhbm5lbC5kZWRpY2F0ZUZvck1vdmFibGVSZXF1ZXN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBjaGFubmVsO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5jbG9zZSA9IGZ1bmN0aW9uIGNsb3NlKGNsb3NlZENhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKGNoYW5uZWxzQ3JlYXRlZCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICdDYW5ub3QgY2xvc2Ugc2Vzc2lvbiBiZWZvcmUgb3BlbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGlzQ2xvc2VDYWxsZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnQ2Fubm90IGNsb3NlIHNlc3Npb24gdHdpY2UnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaXNDbG9zZUNhbGxlZCA9IHRydWU7XHJcbiAgICAgICAgY2xvc2VDYWxsYmFja1BlbmRpbmcgPSBjbG9zZWRDYWxsYmFjaztcclxuICAgICAgICBcclxuICAgICAgICBpZiAoY2xvc2VTZXNzaW9uVXJsICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgY2xvc2VJbnRlcm5hbCgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNsb3NlSW50ZXJuYWwoKSB7XHJcbiAgICAgICAgaWYgKGtlZXBBbGl2ZUludGVydmFsSGFuZGxlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWxGdW5jdGlvbihrZWVwQWxpdmVJbnRlcnZhbEhhbmRsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHNlc3Npb25IZWxwZXIuc2V0SXNSZWFkeShmYWxzZSk7XHJcbiAgICAgICAgc2Vzc2lvbkhlbHBlci5zZW5kQWpheChjbG9zZVNlc3Npb25VcmwsIGNsb3NlQ2FsbGJhY2tQZW5kaW5nKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlQ2hhbm5lbChpc0RlZGljYXRlZEZvck1vdmFibGVSZXF1ZXN0KSB7XHJcbiAgICAgICAgKytjaGFubmVsc0NyZWF0ZWQ7XHJcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBqcGlwRmFjdG9yeS5jcmVhdGVDaGFubmVsKFxyXG4gICAgICAgICAgICBtYXhSZXF1ZXN0c1dhaXRpbmdGb3JSZXNwb25zZUluQ2hhbm5lbCwgc2Vzc2lvbkhlbHBlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2Vzc2lvbkhlbHBlci5jaGFubmVsQ3JlYXRlZChjaGFubmVsKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIWlzRGVkaWNhdGVkRm9yTW92YWJsZVJlcXVlc3QpIHtcclxuICAgICAgICAgICAgbm9uRGVkaWNhdGVkQ2hhbm5lbHMucHVzaChjaGFubmVsKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjaGFubmVsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRDaGFubmVsV2l0aE1pbmltYWxXYWl0aW5nUmVxdWVzdHMoXHJcbiAgICAgICAgbWF4UmVxdWVzdHNJbkNoYW5uZWwsIGlzRXh0cmFjdEZyb21Ob25EZWRpY2F0ZWRMaXN0KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBudWxsO1xyXG4gICAgICAgIHZhciBpbmRleDtcclxuICAgICAgICB2YXIgbWluaW1hbFdhaXRpbmdSZXF1ZXN0cyA9IG1heFJlcXVlc3RzSW5DaGFubmVsICsgMTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vbkRlZGljYXRlZENoYW5uZWxzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciB3YWl0aW5nUmVxdWVzdHMgPVxyXG4gICAgICAgICAgICAgICAgbm9uRGVkaWNhdGVkQ2hhbm5lbHNbaV0uZ2V0QWxsUXVldWVkUmVxdWVzdENvdW50KCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAod2FpdGluZ1JlcXVlc3RzIDwgbWluaW1hbFdhaXRpbmdSZXF1ZXN0cykge1xyXG4gICAgICAgICAgICAgICAgY2hhbm5lbCA9IG5vbkRlZGljYXRlZENoYW5uZWxzW2ldO1xyXG4gICAgICAgICAgICAgICAgaW5kZXggPSBpO1xyXG4gICAgICAgICAgICAgICAgbWluaW1hbFdhaXRpbmdSZXF1ZXN0cyA9IHdhaXRpbmdSZXF1ZXN0cztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHdhaXRpbmdSZXF1ZXN0cyA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFpc0V4dHJhY3RGcm9tTm9uRGVkaWNhdGVkTGlzdCB8fCBjaGFubmVsID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjaGFubmVsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBub25EZWRpY2F0ZWRDaGFubmVsc1tpbmRleF0gPVxyXG4gICAgICAgICAgICBub25EZWRpY2F0ZWRDaGFubmVsc1tub25EZWRpY2F0ZWRDaGFubmVscy5sZW5ndGggLSAxXTtcclxuICAgICAgICBub25EZWRpY2F0ZWRDaGFubmVscy5sZW5ndGggLT0gMTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gY2hhbm5lbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2Vzc2lvblJlYWR5Q2FsbGJhY2soKSB7XHJcbiAgICAgICAgdmFyIG1haW5IZWFkZXJEYXRhYmluID0gZGF0YWJpbnNTYXZlci5nZXRNYWluSGVhZGVyRGF0YWJpbigpO1xyXG4gICAgICAgIGlmICghbWFpbkhlYWRlckRhdGFiaW4uaXNBbGxEYXRhYmluTG9hZGVkKCkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLklsbGVnYWxEYXRhRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ01haW4gaGVhZGVyIHdhcyBub3QgbG9hZGVkIG9uIHNlc3Npb24gY3JlYXRpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGFyYml0cmFyeUNoYW5uZWwgPSBzZXNzaW9uSGVscGVyLmdldEZpcnN0Q2hhbm5lbCgpO1xyXG4gICAgICAgIHZhciBhcmJpdHJhcnlDaGFubmVsSWQgPSBhcmJpdHJhcnlDaGFubmVsLmdldENoYW5uZWxJZCgpO1xyXG4gICAgICAgIGNsb3NlU2Vzc2lvblVybCA9IGNoYW5uZWxNYW5hZ2VtZW50VXJsICtcclxuICAgICAgICAgICAgJyZjY2xvc2U9KicgK1xyXG4gICAgICAgICAgICAnJmNpZD0nICsgYXJiaXRyYXJ5Q2hhbm5lbElkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc0Nsb3NlQ2FsbGVkKSB7XHJcbiAgICAgICAgICAgIGNsb3NlSW50ZXJuYWwoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoYXJiaXRyYXJ5Q2hhbm5lbElkID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgLy8gRmFpbHVyZSBpbmRpY2F0aW9uIGFscmVhZHkgcmV0dXJuZWQgaW4gSnBpcFJlcXVlc3RcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAga2VlcEFsaXZlSW50ZXJ2YWxIYW5kbGUgPSBzZXRJbnRlcnZhbEZ1bmN0aW9uKFxyXG4gICAgICAgICAgICBrZWVwQWxpdmVIYW5kbGVyLCBLRUVQX0FMSVZFX0lOVEVSVkFMKTtcclxuICAgICAgICBcclxuICAgICAgICBzZXNzaW9uSGVscGVyLnNldElzUmVhZHkodHJ1ZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGtlZXBBbGl2ZUhhbmRsZXIoKSB7XHJcbiAgICAgICAgaWYgKHNlc3Npb25IZWxwZXIuZ2V0QWN0aXZlUmVxdWVzdHNDb3VudCgpID4gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBhcmJpdHJhcnlDaGFubmVsID0gc2Vzc2lvbkhlbHBlci5nZXRGaXJzdENoYW5uZWwoKTtcclxuICAgICAgICBhcmJpdHJhcnlDaGFubmVsLnNlbmRNaW5pbWFsUmVxdWVzdChmdW5jdGlvbiBkdW1teUNhbGxiYWNrKCkge30pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBlbnN1cmVSZWFkeSgpIHtcclxuICAgICAgICBpZiAoc2Vzc2lvbkhlbHBlciA9PT0gbnVsbCB8fCAhc2Vzc2lvbkhlbHBlci5nZXRJc1JlYWR5KCkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oJ0Nhbm5vdCBwZXJmb3JtICcgK1xyXG4gICAgICAgICAgICAgICAgJ3RoaXMgb3BlcmF0aW9uIHdoZW4gdGhlIHNlc3Npb24gaXMgbm90IHJlYWR5Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uIEpwaXBCaXRzdHJlYW1SZWFkZXJDbG9zdXJlKCkge1xyXG4gICAgdmFyIHplcm9CaXRzVW50aWxGaXJzdE9uZUJpdE1hcCA9IGNyZWF0ZVplcm9CaXRzVW50aWxGaXJzdE9uZUJpdE1hcCgpO1xyXG5cclxuICAgIGZ1bmN0aW9uIEpwaXBCaXRzdHJlYW1SZWFkZXIoZGF0YWJpbiwgdHJhbnNhY3Rpb25IZWxwZXIpIHtcclxuICAgICAgICB2YXIgaW5pdGlhbFN0YXRlID0ge1xyXG4gICAgICAgICAgICBuZXh0T2Zmc2V0VG9QYXJzZTogMCxcclxuICAgICAgICAgICAgdmFsaWRCaXRzSW5DdXJyZW50Qnl0ZTogMCxcclxuICAgICAgICAgICAgb3JpZ2luYWxCeXRlV2l0aG91dFNoaWZ0OiBudWxsLFxyXG4gICAgICAgICAgICBjdXJyZW50Qnl0ZTogbnVsbCxcclxuICAgICAgICAgICAgaXNTa2lwTmV4dEJ5dGU6IGZhbHNlXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBzdHJlYW1TdGF0ZSA9IHRyYW5zYWN0aW9uSGVscGVyLmNyZWF0ZVRyYW5zYWN0aW9uYWxPYmplY3QoaW5pdGlhbFN0YXRlKTtcclxuICAgICAgICB2YXIgYWN0aXZlVHJhbnNhY3Rpb24gPSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnYWN0aXZlVHJhbnNhY3Rpb24nLCB7XHJcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gZ2V0QWN0aXZlVHJhbnNhY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aXZlVHJhbnNhY3Rpb24gPT09IG51bGwgfHxcclxuICAgICAgICAgICAgICAgICAgICAhYWN0aXZlVHJhbnNhY3Rpb24uaXNBY3RpdmUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ05vIGFjdGl2ZSB0cmFuc2FjdGlvbiBpbiBiaXRzdHJlYW1SZWFkZXInKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjdGl2ZVRyYW5zYWN0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdiaXRzQ291bnRlcicsIHtcclxuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXRCaXRzQ291bnRlcigpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSA9IHN0cmVhbVN0YXRlLmdldFZhbHVlKGFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdHJ5VmFsaWRhdGVDdXJyZW50Qnl0ZShkYXRhYmluLCBzdGF0ZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGUuaXNTa2lwTmV4dEJ5dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgc3RhdGUgb2YgYml0c3RyZWFtUmVhZGVyOiAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1doZW4gMHhGRiBlbmNvdW50ZXJlZCwgdHJ5VmFsaWRhdGVDdXJyZW50Qnl0ZSAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3Nob3VsZCBza2lwIHRoZSB3aG9sZSBieXRlICBhZnRlciAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NoaWZ0UmVtYWluaW5nQml0c0luQnl0ZSBhbmQgY2xlYXIgaXNTa2lwTmV4dEJ5dGUuICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnSG93ZXZlciB0aGUgZmxhZyBpcyBzdGlsbCBzZXQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHN0YXRlLm5leHRPZmZzZXRUb1BhcnNlICogOCAtIHN0YXRlLnZhbGlkQml0c0luQ3VycmVudEJ5dGU7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2RhdGFiaW5PZmZzZXQnLCB7XHJcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gZ2V0RGF0YWJpbk9mZnNldCgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSA9IHN0cmVhbVN0YXRlLmdldFZhbHVlKGFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLmlzU2tpcE5leHRCeXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRlLm5leHRPZmZzZXRUb1BhcnNlICsgMTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLnZhbGlkQml0c0luQ3VycmVudEJ5dGUgJSA4ICE9PSAwIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUub3JpZ2luYWxCeXRlV2l0aG91dFNoaWZ0ID09PSAweEZGKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdDYW5ub3QgY2FsY3VsYXRlIGRhdGFiaW4gb2Zmc2V0IHdoZW4gYml0c3RyZWFtUmVhZGVyICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnIGlzIGluIHRoZSBtaWRkbGUgb2YgdGhlIGJ5dGUnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRlLm5leHRPZmZzZXRUb1BhcnNlIC0gc3RhdGUudmFsaWRCaXRzSW5DdXJyZW50Qnl0ZSAvIDg7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIHNldERhdGFiaW5PZmZzZXQob2Zmc2V0SW5CeXRlcykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0YXRlID0gc3RyZWFtU3RhdGUuZ2V0VmFsdWUoYWN0aXZlVHJhbnNhY3Rpb24pO1xyXG4gICAgICAgICAgICAgICAgc3RhdGUudmFsaWRCaXRzSW5DdXJyZW50Qnl0ZSA9IDA7XHJcbiAgICAgICAgICAgICAgICBzdGF0ZS5pc1NraXBOZXh0Qnl0ZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgc3RhdGUub3JpZ2luYWxCeXRlV2l0aG91dFNoaWZ0ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIHN0YXRlLm5leHRPZmZzZXRUb1BhcnNlID0gb2Zmc2V0SW5CeXRlcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuc3RhcnROZXdUcmFuc2FjdGlvbiA9IGZ1bmN0aW9uIHN0YXJ0TmV3VHJhbnNhY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmIChhY3RpdmVUcmFuc2FjdGlvbiAhPT0gbnVsbCAmJiBhY3RpdmVUcmFuc2FjdGlvbi5pc0FjdGl2ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ0Nhbm5vdCBzdGFydCBuZXcgdHJhbnNhY3Rpb24gaW4gYml0c3RyZWFtUmVhZGVyICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICd3aGlsZSBhbm90aGVyIHRyYW5zYWN0aW9uIGlzIGFjdGl2ZScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhY3RpdmVUcmFuc2FjdGlvbiA9IHRyYW5zYWN0aW9uSGVscGVyLmNyZWF0ZVRyYW5zYWN0aW9uKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnNoaWZ0UmVtYWluaW5nQml0c0luQnl0ZSA9IGZ1bmN0aW9uIHNoaWZ0UmVtYWluaW5nQml0c0luQnl0ZSgpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRlID0gc3RyZWFtU3RhdGUuZ2V0VmFsdWUoYWN0aXZlVHJhbnNhY3Rpb24pO1xyXG5cclxuICAgICAgICAgICAgc3RhdGUuaXNTa2lwTmV4dEJ5dGUgPSBzdGF0ZS5vcmlnaW5hbEJ5dGVXaXRob3V0U2hpZnQgPT09IDB4RkY7XHJcbiAgICAgICAgICAgIHN0YXRlLnZhbGlkQml0c0luQ3VycmVudEJ5dGUgPSBNYXRoLmZsb29yKFxyXG4gICAgICAgICAgICAgICAgc3RhdGUudmFsaWRCaXRzSW5DdXJyZW50Qnl0ZSAvIDgpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5zaGlmdEJpdCA9IGZ1bmN0aW9uIHNoaWZ0Qml0KCkge1xyXG4gICAgICAgICAgICB2YXIgc3RhdGUgPSBzdHJlYW1TdGF0ZS5nZXRWYWx1ZShhY3RpdmVUcmFuc2FjdGlvbik7XHJcbiAgICAgICAgICAgIGlmICghdHJ5VmFsaWRhdGVDdXJyZW50Qnl0ZShkYXRhYmluLCBzdGF0ZSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgb25lc0NvdW50ID0gY291bnRBbmRTaGlmdEJpdHMoXHJcbiAgICAgICAgICAgICAgICBkYXRhYmluLFxyXG4gICAgICAgICAgICAgICAgc3RhdGUsXHJcbiAgICAgICAgICAgICAgICAvKmlzVW50aWxaZXJvQml0PSovdHJ1ZSxcclxuICAgICAgICAgICAgICAgIC8qbWF4Qml0c1RvU2hpZnQ9Ki8xKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBvbmVzQ291bnQ7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmNvdW50WmVyb3NBbmRTaGlmdFVudGlsRmlyc3RPbmVCaXQgPVxyXG4gICAgICAgICAgICBmdW5jdGlvbiBjb3VudFplcm9zQW5kU2hpZnRVbnRpbEZpcnN0T25lQml0KG1heEJpdHNUb1NoaWZ0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgc3RhdGUgPSBzdHJlYW1TdGF0ZS5nZXRWYWx1ZShhY3RpdmVUcmFuc2FjdGlvbik7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gY291bnRBbmRTaGlmdEJpdHMoXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YWJpbiwgc3RhdGUsIC8qaXNVbnRpbFplcm9CaXQ9Ki9mYWxzZSwgbWF4Qml0c1RvU2hpZnQpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuY291bnRPbmVzQW5kU2hpZnRVbnRpbEZpcnN0WmVyb0JpdCA9XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGNvdW50T25lc0FuZFNoaWZ0VW50aWxGaXJzdFplcm9CaXQobWF4Qml0c1RvU2hpZnQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSA9IHN0cmVhbVN0YXRlLmdldFZhbHVlKGFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBjb3VudEFuZFNoaWZ0Qml0cyhcclxuICAgICAgICAgICAgICAgICAgICBkYXRhYmluLCBzdGF0ZSwgLyppc1VudGlsWmVyb0JpdD0qL3RydWUsIG1heEJpdHNUb1NoaWZ0KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnNoaWZ0Qml0cyA9IGZ1bmN0aW9uIHNoaWZ0Qml0cyhiaXRzQ291bnQpIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IDA7XHJcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHN0cmVhbVN0YXRlLmdldFZhbHVlKGFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICAgICAgdmFyIHJlbWFpbmluZ0JpdHMgPSBiaXRzQ291bnQ7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB3aGlsZSAocmVtYWluaW5nQml0cyA+IDApIHtcclxuICAgICAgICAgICAgICAgIGlmICghdHJ5VmFsaWRhdGVDdXJyZW50Qnl0ZShkYXRhYmluLCBzdGF0ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGJpdHNUb1Rha2UgPSBNYXRoLm1pbihcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZS52YWxpZEJpdHNJbkN1cnJlbnRCeXRlLCByZW1haW5pbmdCaXRzKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGFkZFRvUmVzdWx0ID0gc3RhdGUuY3VycmVudEJ5dGUgPj4gKDggLSBiaXRzVG9UYWtlKTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IChyZXN1bHQgPDwgYml0c1RvVGFrZSkgKyBhZGRUb1Jlc3VsdDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmVtb3ZlQml0c0Zyb21CeXRlKHN0YXRlLCBiaXRzVG9UYWtlKTtcclxuICAgICAgICAgICAgICAgIHJlbWFpbmluZ0JpdHMgLT0gYml0c1RvVGFrZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjb3VudEFuZFNoaWZ0Qml0cyhkYXRhYmluLCBzdGF0ZSwgaXNVbnRpbFplcm9CaXQsIG1heEJpdHNUb1NoaWZ0KSB7XHJcbiAgICAgICAgdmFyIGNvdW50ZWRCaXRzID0gMDtcclxuICAgICAgICB2YXIgZm91bmRUZXJtaW5hdGluZ0JpdDtcclxuICAgICAgICB2YXIgcmVtYWluaW5nQml0cyA9IG1heEJpdHNUb1NoaWZ0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgaWYgKCF0cnlWYWxpZGF0ZUN1cnJlbnRCeXRlKGRhdGFiaW4sIHN0YXRlKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBieXRlVmFsdWUgPSBpc1VudGlsWmVyb0JpdCA/IH5zdGF0ZS5jdXJyZW50Qnl0ZSA6IHN0YXRlLmN1cnJlbnRCeXRlO1xyXG4gICAgICAgICAgICB2YXIgYml0c0NvdW50SW5jbHVkaW5nVGVybWluYXRpbmdCaXQgPSBNYXRoLm1pbihcclxuICAgICAgICAgICAgICAgIHplcm9CaXRzVW50aWxGaXJzdE9uZUJpdE1hcFtieXRlVmFsdWVdLFxyXG4gICAgICAgICAgICAgICAgc3RhdGUudmFsaWRCaXRzSW5DdXJyZW50Qnl0ZSArIDEpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGJpdHNDb3VudE5vdEluY2x1ZGluZ1Rlcm1pbmF0aW5nQml0ID1cclxuICAgICAgICAgICAgICAgIGJpdHNDb3VudEluY2x1ZGluZ1Rlcm1pbmF0aW5nQml0IC0gMTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmdCaXRzICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChiaXRzQ291bnRJbmNsdWRpbmdUZXJtaW5hdGluZ0JpdCA+IHJlbWFpbmluZ0JpdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVCaXRzRnJvbUJ5dGUoc3RhdGUsIHJlbWFpbmluZ0JpdHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvdW50ZWRCaXRzICs9IHJlbWFpbmluZ0JpdHM7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJlbWFpbmluZ0JpdHMgLT0gYml0c0NvdW50Tm90SW5jbHVkaW5nVGVybWluYXRpbmdCaXQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvdW50ZWRCaXRzICs9IGJpdHNDb3VudE5vdEluY2x1ZGluZ1Rlcm1pbmF0aW5nQml0O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm91bmRUZXJtaW5hdGluZ0JpdCA9XHJcbiAgICAgICAgICAgICAgICBiaXRzQ291bnRJbmNsdWRpbmdUZXJtaW5hdGluZ0JpdCA8PSBzdGF0ZS52YWxpZEJpdHNJbkN1cnJlbnRCeXRlO1xyXG5cclxuICAgICAgICAgICAgaWYgKGZvdW5kVGVybWluYXRpbmdCaXQpIHtcclxuICAgICAgICAgICAgICAgIHJlbW92ZUJpdHNGcm9tQnl0ZShzdGF0ZSwgYml0c0NvdW50SW5jbHVkaW5nVGVybWluYXRpbmdCaXQpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3RhdGUudmFsaWRCaXRzSW5DdXJyZW50Qnl0ZSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IHdoaWxlICghZm91bmRUZXJtaW5hdGluZ0JpdCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGNvdW50ZWRCaXRzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiByZW1vdmVCaXRzRnJvbUJ5dGUoc3RhdGUsIGJpdHNDb3VudCkge1xyXG4gICAgICAgIHN0YXRlLnZhbGlkQml0c0luQ3VycmVudEJ5dGUgLT0gYml0c0NvdW50O1xyXG4gICAgICAgIGlmIChzdGF0ZS52YWxpZEJpdHNJbkN1cnJlbnRCeXRlID4gMCkge1xyXG4gICAgICAgICAgICBzdGF0ZS5jdXJyZW50Qnl0ZSA9IChzdGF0ZS5jdXJyZW50Qnl0ZSA8PCBiaXRzQ291bnQpICYgMHhGRjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdHJ5VmFsaWRhdGVDdXJyZW50Qnl0ZShkYXRhYmluLCBzdGF0ZSkge1xyXG4gICAgICAgIGlmIChzdGF0ZS52YWxpZEJpdHNJbkN1cnJlbnRCeXRlID4gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGJ5dGVzTmVlZGVkID0gc3RhdGUuaXNTa2lwTmV4dEJ5dGUgPyAyIDogMTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0QXJyYXkgPSBbXTtcclxuICAgICAgICB2YXIgYnl0ZXNDb3BpZWQgPSBkYXRhYmluLmNvcHlCeXRlcyhyZXN1bHRBcnJheSwgLypyZXN1bHRTdGFydE9mZnNldD0qLzAsIHtcclxuICAgICAgICAgICAgZm9yY2VDb3B5QWxsUmFuZ2U6IHRydWUsXHJcbiAgICAgICAgICAgIGRhdGFiaW5TdGFydE9mZnNldDogc3RhdGUubmV4dE9mZnNldFRvUGFyc2UsXHJcbiAgICAgICAgICAgIG1heExlbmd0aFRvQ29weTogYnl0ZXNOZWVkZWRcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGJ5dGVzQ29waWVkICE9PSBieXRlc05lZWRlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcHJldkJ5dGUgPSBzdGF0ZS5vcmlnaW5hbEJ5dGVXaXRob3V0U2hpZnQ7XHJcblxyXG4gICAgICAgIHN0YXRlLmN1cnJlbnRCeXRlID0gcmVzdWx0QXJyYXlbYnl0ZXNOZWVkZWQgLSAxXTtcclxuICAgICAgICBzdGF0ZS52YWxpZEJpdHNJbkN1cnJlbnRCeXRlID0gODtcclxuICAgICAgICBzdGF0ZS5vcmlnaW5hbEJ5dGVXaXRob3V0U2hpZnQgPSBzdGF0ZS5jdXJyZW50Qnl0ZTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAocHJldkJ5dGUgPT09IDB4RkYpIHtcclxuICAgICAgICAgICAgaWYgKChyZXN1bHRBcnJheVswXSAmIDB4ODApICE9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuajJrRXhjZXB0aW9ucy5JbGxlZ2FsRGF0YUV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAnRXhwZWN0ZWQgMCBiaXQgYWZ0ZXIgMHhGRiBieXRlJywgJ0IuMTAuMScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBObyBuZWVkIHRvIHNraXAgYW5vdGhlciBiaXQgaWYgYWxyZWFkeSBza2lwIHRoZSB3aG9sZSBieXRlXHJcbiAgICAgICAgICAgIGlmICghc3RhdGUuaXNTa2lwTmV4dEJ5dGUpIHtcclxuICAgICAgICAgICAgICAgIHN0YXRlLmN1cnJlbnRCeXRlIDw8PSAxO1xyXG4gICAgICAgICAgICAgICAgc3RhdGUudmFsaWRCaXRzSW5DdXJyZW50Qnl0ZSA9IDc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3RhdGUuaXNTa2lwTmV4dEJ5dGUgPSBmYWxzZTtcclxuICAgICAgICBzdGF0ZS5uZXh0T2Zmc2V0VG9QYXJzZSArPSBieXRlc05lZWRlZDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVaZXJvQml0c1VudGlsRmlyc3RPbmVCaXRNYXAoKSB7XHJcbiAgICAgICAgdmFyIGFycmF5TWFwID0gbmV3IEFycmF5KDI1NSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXJyYXlNYXBbMHgwMF0gPSA5O1xyXG4gICAgICAgIGFycmF5TWFwWzB4MDFdID0gODtcclxuICAgICAgICBhcnJheU1hcFsweDAyXSA9IDc7XHJcbiAgICAgICAgYXJyYXlNYXBbMHgwM10gPSA3O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAoaSA9IDB4MDQ7IGkgPD0gMHgwNzsgKytpKSB7XHJcbiAgICAgICAgICAgIGFycmF5TWFwW2ldID0gNjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChpID0gMHgwODsgaSA8PSAweDBGOyArK2kpIHtcclxuICAgICAgICAgICAgYXJyYXlNYXBbaV0gPSA1O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChpID0gMHgxMDsgaSA8PSAweDFGOyArK2kpIHtcclxuICAgICAgICAgICAgYXJyYXlNYXBbaV0gPSA0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChpID0gMHgyMDsgaSA8PSAweDNGOyArK2kpIHtcclxuICAgICAgICAgICAgYXJyYXlNYXBbaV0gPSAzO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBmb3IgKGkgPSAweDQwOyBpIDw9IDB4N0Y7ICsraSkge1xyXG4gICAgICAgICAgICBhcnJheU1hcFtpXSA9IDI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAoaSA9IDB4ODA7IGkgPD0gMHhGRjsgKytpKSB7XHJcbiAgICAgICAgICAgIGFycmF5TWFwW2ldID0gMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQXZvaWQgdHdvJ3MgY29tcGxlbWVudCBwcm9ibGVtc1xyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPD0gMHhGRjsgKytpKSB7XHJcbiAgICAgICAgICAgIGFycmF5TWFwW2kgLSAweDEwMF0gPSBhcnJheU1hcFtpXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGFycmF5TWFwO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gSnBpcEJpdHN0cmVhbVJlYWRlcjtcclxufSkoKTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiBKcGlwQ29kZWJsb2NrTGVuZ3RoUGFyc2VyQ2xvc3VyZSgpIHtcclxuICAgIC8vIEIuMTAuNy5cclxuICAgIFxyXG4gICAgdmFyIGV4YWN0TG9nMlRhYmxlID0gY3JlYXRlRXhhY3RMb2cyVGFibGUoKTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gSnBpcENvZGVibG9ja0xlbmd0aFBhcnNlcihiaXRzdHJlYW1SZWFkZXIsIHRyYW5zYWN0aW9uSGVscGVyKSB7XHJcbiAgICAgICAgdmFyIGxCbG9jayA9IHRyYW5zYWN0aW9uSGVscGVyLmNyZWF0ZVRyYW5zYWN0aW9uYWxPYmplY3Qoe1xyXG4gICAgICAgICAgICBsQmxvY2tWYWx1ZTogM1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UoY29kaW5nUGFzc2VzKSB7XHJcbiAgICAgICAgICAgIHZhciBhZGRUb0xCbG9jayA9IGJpdHN0cmVhbVJlYWRlci5jb3VudE9uZXNBbmRTaGlmdFVudGlsRmlyc3RaZXJvQml0KCk7XHJcbiAgICAgICAgICAgIGlmIChhZGRUb0xCbG9jayA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBsQmxvY2tTdGF0ZSA9IGxCbG9jay5nZXRWYWx1ZShiaXRzdHJlYW1SZWFkZXIuYWN0aXZlVHJhbnNhY3Rpb24pO1xyXG4gICAgICAgICAgICBsQmxvY2tTdGF0ZS5sQmxvY2tWYWx1ZSArPSBhZGRUb0xCbG9jaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBjb2RpbmdQYXNzZXNMb2cyID0gZXhhY3RMb2cyVGFibGVbY29kaW5nUGFzc2VzXTtcclxuICAgICAgICAgICAgaWYgKGNvZGluZ1Bhc3Nlc0xvZzIgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgdmFsdWUgb2YgY29kaW5nIHBhc3NlcyAnICsgY29kaW5nUGFzc2VzICtcclxuICAgICAgICAgICAgICAgICAgICAnLiBFeHBlY3RlZCBwb3NpdGl2ZSBpbnRlZ2VyIDw9IDE2NCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYml0c0NvdW50ID0gbEJsb2NrU3RhdGUubEJsb2NrVmFsdWUgKyBjb2RpbmdQYXNzZXNMb2cyO1xyXG4gICAgICAgICAgICB2YXIgbGVuZ3RoID0gYml0c3RyZWFtUmVhZGVyLnNoaWZ0Qml0cyhiaXRzQ291bnQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGxlbmd0aDtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVFeGFjdExvZzJUYWJsZSgpIHtcclxuICAgICAgICB2YXIgbWF4Q29kaW5nUGFzc2VzUG9zc2libGUgPSAxNjQ7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheShtYXhDb2RpbmdQYXNzZXNQb3NzaWJsZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGlucHV0VmFsdWVMb3dlckJvdW5kID0gMTtcclxuICAgICAgICB2YXIgaW5wdXRWYWx1ZVVwcGVyQm91bmQgPSAyO1xyXG4gICAgICAgIHZhciBsb2cyUmVzdWx0ID0gMDtcclxuICAgICAgICBcclxuICAgICAgICB3aGlsZSAoaW5wdXRWYWx1ZUxvd2VyQm91bmQgPD0gbWF4Q29kaW5nUGFzc2VzUG9zc2libGUpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IGlucHV0VmFsdWVMb3dlckJvdW5kOyBpIDwgaW5wdXRWYWx1ZVVwcGVyQm91bmQ7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0W2ldID0gbG9nMlJlc3VsdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaW5wdXRWYWx1ZUxvd2VyQm91bmQgKj0gMjtcclxuICAgICAgICAgICAgaW5wdXRWYWx1ZVVwcGVyQm91bmQgKj0gMjtcclxuICAgICAgICAgICAgKytsb2cyUmVzdWx0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gSnBpcENvZGVibG9ja0xlbmd0aFBhcnNlcjtcclxufSkoKTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiBKcGlwQ29kaW5nUGFzc2VzTnVtYmVyUGFyc2VyQ2xvc3VyZSgpIHtcclxuICAgIC8vIFRhYmxlIEIuNCBpbiBwYXJ0IDEgb2YgdGhlIEpwZWcyMDAwIHN0YW5kYXJkIHNob3dzIDcgY2FzZXNcclxuICAgIC8vIG9mIHZhbHVlcy4gVGhlIGFsZ29yaXRobSBzaG93biBoZXJlIHNlcGFyYXRlcyB0aG9zZSBjYXNlc1xyXG4gICAgLy8gaW50byAxNiBjYXNlcywgZGVwZW5kcyBvbiB0aGUgbnVtYmVyIG9mIG9uZXMgaW4gdGhlIHByZWZpeFxyXG4gICAgLy8gb2YgdGhlIGNvZGVkIG51bWJlciB1bnRpbCB0aGUgZmlyc3QgemVyby5cclxuICAgIC8vIFRoZSBwYXJzaW5nIGlzIGRvbmUgaW4gdHdvIHN0YWdlczogZmlyc3Qgd2UgY291bnQgdGhlIG9uZXMgdW50aWxcclxuICAgIC8vIHRoZSBmaXJzdCB6ZXJvLCBsYXRlciB3ZSBwYXJzZSB0aGUgb3RoZXIgYml0cy5cclxuICAgIFxyXG4gICAgLy8gRm9yIGV4YW1wbGUsIHRoZSBjYXNlIG9mIDExMDEgKHdoaWNoIHJlcHJlc2VudHMgNCBhY2NvcmRpbmcgdG9cclxuICAgIC8vIHRhYmxlIEIuNCkgaXMgcGFyc2VkIGluIHR3byBzdGFnZXMuIEZpcnN0IHdlIGNvdW50IHRoZSBvbmVzIGluXHJcbiAgICAvLyB0aGUgYmVnaW5uaW5nIHVudGlsIHRoZSBmaXJzdCB6ZXJvLCB0aGUgcmVzdWx0IGlzIDIgKCcxMTAnKS4gVGhlbiB3ZVxyXG4gICAgLy8gcGFyc2UgdGhlIG90aGVyIGJpdHMgKCcxJykuXHJcbiAgICBcclxuICAgIC8vIEFmdGVyIHRoZSBmaXJzdCBwYXJzaW5nIHN0YWdlIChjb3VudCBvZiBvbmVzKSwgd2Uga25vdyB0d28gdGhpbmdzOlxyXG4gICAgLy8gLSBIb3cgbWFueSBiaXRzIHdlIG5lZWQgdG8gdGFrZSBhZnRlciB0aGUgZmlyc3QgemVybyAoc2luZ2xlIGJpdCBpblxyXG4gICAgLy8gICB0aGUgYWJvdmUgY2FzZSBvZiAnMTEwJyBwcmVmaXgpLlxyXG4gICAgLy8gLSBIb3cgbXVjaCB3ZSBuZWVkIHRvIGFkZCB0byB0aGUgcmVzdWx0IG9mIHBhcnNpbmcgdGhlIG90aGVyIGJpdHMgKDNcclxuICAgIC8vICAgICBpbiB0aGUgYWJvdmUgY2FzZSBvZiAnMTEwJyBwcmVmaXgpLlxyXG4gICAgXHJcbiAgICAvLyBBY3R1YWxseSB0aGUgMTYgY2FzZXMgd2VyZSBleHRyYWN0ZWQgZnJvbSB0aGUgdGFibGUgd2l0aG91dCBhbnkgZm9ybXVsYSxcclxuICAgIC8vIHNvIHdlIGNhbiByZWZlciB0aGUgbnVtYmVyIG9mIG9uZXMgYXMgJ2tleXdvcmRzJyBvbmx5LlxyXG5cclxuICAgIHZhciBiaXRzTmVlZGVkQWZ0ZXJDb3VudE9mT25lcyA9IGNyZWF0ZUJpdHNOZWVkZWRBZnRlckNvdW50T2ZPbmVzTWFwKCk7XHJcbiAgICB2YXIgYWRkVG9SZXN1bHRBZnRlckNvdW50T2ZPbmVzID0gY3JlYXRlQWRkVG9SZXN1bHRBZnRlckNvdW50T2ZPbmVzTWFwKCk7XHJcblxyXG4gICAgdmFyIGpwaXBDb2RpbmdQYXNzZXNOdW1iZXJQYXJzZXIgPSB7XHJcbiAgICAgICAgcGFyc2U6IGZ1bmN0aW9uIHBhcnNlKGJpdHN0cmVhbVJlYWRlcikge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG9uZXNDb3VudCA9IGJpdHN0cmVhbVJlYWRlci5jb3VudE9uZXNBbmRTaGlmdFVudGlsRmlyc3RaZXJvQml0KFxyXG4gICAgICAgICAgICAgICAgLyptYXhCaXRzVG9TaGlmdD0qLzE2KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChvbmVzQ291bnQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbW9yZUJpdHNOZWVkZWQgPSBiaXRzTmVlZGVkQWZ0ZXJDb3VudE9mT25lc1tvbmVzQ291bnRdO1xyXG4gICAgICAgICAgICB2YXIgbW9yZUJpdHMgPSBiaXRzdHJlYW1SZWFkZXIuc2hpZnRCaXRzKG1vcmVCaXRzTmVlZGVkKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChtb3JlQml0cyA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBhZGRUb1Jlc3VsdCA9IGFkZFRvUmVzdWx0QWZ0ZXJDb3VudE9mT25lc1tvbmVzQ291bnRdO1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gbW9yZUJpdHMgKyBhZGRUb1Jlc3VsdDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlQml0c05lZWRlZEFmdGVyQ291bnRPZk9uZXNNYXAoKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheSgxNyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gVGhlIGNhc2Ugb2YgJzAnOiBBZnRlciAwIG9uZXMgYW5kIHNpbmdsZSB6ZXJvLCBuZWVkcyBubyBtb3JlIGJpdHNcclxuICAgICAgICByZXN1bHRbMF0gPSAwO1xyXG5cclxuICAgICAgICAvLyBUaGUgY2FzZSBvZiAnMTAnOiBBZnRlciAxIG9uZXMgYW5kIHNpbmdsZSB6ZXJvLCBuZWVkcyBubyBtb3JlIGJpdHNcclxuICAgICAgICByZXN1bHRbMV0gPSAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFRoZSBjYXNlcyBvZiAnMTEweCc6IEFmdGVyIDIgb25lcyBhbmQgc2luZ2xlIHplcm8sIG5lZWRzIGFub3RoZXIgYml0XHJcbiAgICAgICAgcmVzdWx0WzJdID0gMTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBUaGUgY2FzZSBvZiAnMTExMCc6IEFmdGVyIDMgb25lcyBhbmQgc2luZ2xlIHplcm8sIG5lZWRzIG5vIG1vcmUgYml0c1xyXG4gICAgICAgIHJlc3VsdFszXSA9IDA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gVGhlIGNhc2VzIG9mICcxMTExIDAwMDAgMCcgdG8gJzExMTEgMTExMSAwJzpcclxuICAgICAgICAvLyBBZnRlciA0IHRvIDggb25lcyBhbmQgc2luZ2xlIHplcm8sIG5lZWRzIGJpdHMgdG8gY29tcGxldGUgdG8gOSBiaXRzXHJcbiAgICAgICAgcmVzdWx0WzRdID0gNDtcclxuICAgICAgICByZXN1bHRbNV0gPSAzO1xyXG4gICAgICAgIHJlc3VsdFs2XSA9IDI7XHJcbiAgICAgICAgcmVzdWx0WzddID0gMTtcclxuICAgICAgICByZXN1bHRbOF0gPSAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFRoZSBjYXNlcyBvZiAnMTExMSAxMTExMSAuLi4nXHJcbiAgICAgICAgLy8gQWZ0ZXIgYXQgbGVhc3QgOSBvbmVzIGFuZCBzaW5nbGUgemVybywgbmVlZHMgYml0cyB0byBjb21wbGV0ZSB0byAxNiBiaXRzXHJcbiAgICAgICAgcmVzdWx0WzldID0gNjtcclxuICAgICAgICByZXN1bHRbMTBdID0gNTtcclxuICAgICAgICByZXN1bHRbMTFdID0gNDtcclxuICAgICAgICByZXN1bHRbMTJdID0gMztcclxuICAgICAgICByZXN1bHRbMTNdID0gMjtcclxuICAgICAgICByZXN1bHRbMTRdID0gMTtcclxuICAgICAgICByZXN1bHRbMTVdID0gMDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBUaGUgY2FzZSBvZiAnMTExMSAxMTExMSAxMTExIDExMSdcclxuICAgICAgICByZXN1bHRbMTZdID0gMDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVBZGRUb1Jlc3VsdEFmdGVyQ291bnRPZk9uZXNNYXAoKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheSgxNyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gVGhlIGNhc2Ugb2YgJzAnIChjb2Rld29yZCBmb3IgMSk6XHJcbiAgICAgICAgLy8gQWZ0ZXIgMCBvbmVzIGFuZCBzaW5nbGUgemVybywgYWRkIDEgdG8gb3RoZXIgMCBiaXRzIHZhbHVlXHJcbiAgICAgICAgcmVzdWx0WzBdID0gMTtcclxuXHJcbiAgICAgICAgLy8gVGhlIGNhc2Ugb2YgJzEwJyAoY29kZXdvcmQgZm9yIDIpOlxyXG4gICAgICAgIC8vIEFmdGVyIDEgb25lcyBhbmQgc2luZ2xlIHplcm8sIGFkZCAyIHRvIG90aGVyIDAgYml0cyB2YWx1ZVxyXG4gICAgICAgIHJlc3VsdFsxXSA9IDI7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gVGhlIGNhc2VzIG9mICcxMTB4JyAoY29kZXdvcmRzIGZvciAzIGFuZCA0KTpcclxuICAgICAgICAvLyBBZnRlciAyIG9uZXMgYW5kIHNpbmdsZSB6ZXJvLCBhZGQgMyB0byBvdGhlciBzaW5nbGUgYml0IHZhbHVlXHJcbiAgICAgICAgcmVzdWx0WzJdID0gMztcclxuICAgICAgICBcclxuICAgICAgICAvLyBUaGUgY2FzZSBvZiAnMTExMCcgKGNvZGV3b3JkIGZvciA1KTpcclxuICAgICAgICAvLyBBZnRlciAzIG9uZXMgYW5kIHNpbmdsZSB6ZXJvLCBhZGQgNSB0byBvdGhlciAwIGJpdHMgdmFsdWVcclxuICAgICAgICByZXN1bHRbM10gPSA1O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFRoZSBjYXNlcyBvZiAnMTExMSAwMDAwIDAnIHRvICcxMTExIDExMTEgMCcgKGNvZGV3b3JkcyBmb3IgNiB0byAzNik6XHJcbiAgICAgICAgLy8gQWZ0ZXIgNCBvbmVzIGFuZCBzaW5nbGUgemVybywgYWRkIDYgdG8gb3RoZXIgMC8xLzIvMy80IGJpdHMgdmFsdWVcclxuICAgICAgICByZXN1bHRbNF0gPSA2ICsgMHgwMDsgLy8gYjAwMDAwXHJcbiAgICAgICAgcmVzdWx0WzVdID0gNiArIDB4MTA7IC8vIGIxMDAwMFxyXG4gICAgICAgIHJlc3VsdFs2XSA9IDYgKyAweDE4OyAvLyBiMTEwMDBcclxuICAgICAgICByZXN1bHRbN10gPSA2ICsgMHgxQzsgLy8gYjExMTAwXHJcbiAgICAgICAgcmVzdWx0WzhdID0gNiArIDB4MUU7IC8vIGIxMTExMFxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFRoZSBjYXNlcyBvZiAnMTExMSAxMTExMSAuLi4nIChjb2Rld29yZHMgZm9yIDM3IHRvIDE2NCk6XHJcbiAgICAgICAgLy8gQWZ0ZXIgOSBvbmVzIGFuZCBzaW5nbGUgemVybywgYWRkIDM3IHRvIG90aGVyIDAvMS8yLzMvNC81LzYgYml0cyB2YWx1ZVxyXG4gICAgICAgIHJlc3VsdFsgOV0gPSAzNyArIDB4MDA7IC8vIGIwMDAwMDBcclxuICAgICAgICByZXN1bHRbMTBdID0gMzcgKyAweDQwOyAvLyBiMTAwMDAwXHJcbiAgICAgICAgcmVzdWx0WzExXSA9IDM3ICsgMHg2MDsgLy8gYjExMDAwMFxyXG4gICAgICAgIHJlc3VsdFsxMl0gPSAzNyArIDB4NzA7IC8vIGIxMTEwMDBcclxuICAgICAgICByZXN1bHRbMTNdID0gMzcgKyAweDc4OyAvLyBiMTExMTAwXHJcbiAgICAgICAgcmVzdWx0WzE0XSA9IDM3ICsgMHg3QzsgLy8gYjExMTExMFxyXG4gICAgICAgIHJlc3VsdFsxNV0gPSAzNyArIDB4N0U7IC8vIGIxMTExMTFcclxuICAgICAgICByZXN1bHRbMTZdID0gMzcgKyAweDdGOyAvLyBiMTExMTExXHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGpwaXBDb2RpbmdQYXNzZXNOdW1iZXJQYXJzZXI7XHJcbn0pKCk7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwUGFja2V0TGVuZ3RoQ2FsY3VsYXRvcihcclxuICAgIHRpbGVTdHJ1Y3R1cmUsXHJcbiAgICBjb21wb25lbnRTdHJ1Y3R1cmUsXHJcbiAgICBkYXRhYmluLFxyXG4gICAgc3RhcnRPZmZzZXRJbkRhdGFiaW4sXHJcbiAgICBwcmVjaW5jdCxcclxuICAgIGpwaXBGYWN0b3J5KSB7XHJcbiAgICBcclxuICAgIHZhciBjYWxjdWxhdGVkTGVuZ3RocyA9IFtdO1xyXG4gICAgXHJcbiAgICB2YXIgYml0c3RyZWFtUmVhZGVyID0ganBpcEZhY3RvcnkuY3JlYXRlQml0c3RyZWFtUmVhZGVyKGRhdGFiaW4pO1xyXG4gICAgXHJcbiAgICB2YXIgbnVtQ29kZWJsb2Nrc1ggPVxyXG4gICAgICAgIGNvbXBvbmVudFN0cnVjdHVyZS5nZXROdW1Db2RlYmxvY2tzWEluUHJlY2luY3QocHJlY2luY3QpO1xyXG4gICAgdmFyIG51bUNvZGVibG9ja3NZID1cclxuICAgICAgICBjb21wb25lbnRTdHJ1Y3R1cmUuZ2V0TnVtQ29kZWJsb2Nrc1lJblByZWNpbmN0KHByZWNpbmN0KTtcclxuICAgICAgICBcclxuICAgIHZhciBudW1RdWFsaXR5TGF5ZXJzSW5UaWxlID0gdGlsZVN0cnVjdHVyZS5nZXROdW1RdWFsaXR5TGF5ZXJzKCk7XHJcbiAgICB2YXIgaXNQYWNrZXRIZWFkZXJOZWFyRGF0YSA9IHRpbGVTdHJ1Y3R1cmUuZ2V0SXNQYWNrZXRIZWFkZXJOZWFyRGF0YSgpO1xyXG4gICAgdmFyIGlzU3RhcnRPZlBhY2tldE1hcmtlckFsbG93ZWQgPSB0aWxlU3RydWN0dXJlLmdldElzU3RhcnRPZlBhY2tldE1hcmtlckFsbG93ZWQoKTtcclxuICAgIHZhciBpc0VuZFBhY2tldEhlYWRlck1hcmtlckFsbG93ZWQgPVxyXG4gICAgICAgIHRpbGVTdHJ1Y3R1cmUuZ2V0SXNFbmRQYWNrZXRIZWFkZXJNYXJrZXJBbGxvd2VkKCk7XHJcbiAgICBcclxuICAgIHZhciBzdWJiYW5kUGFyc2VycyA9IGluaXRTdWJiYW5kUGFyc2VycygpO1xyXG4gICAgXHJcbiAgICB0aGlzLmNhbGN1bGF0ZUVuZE9mZnNldE9mTGFzdEZ1bGxQYWNrZXQgPVxyXG4gICAgICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZUZ1bGxQYWNrZXRzQXZhaWxhYmxlT2Zmc2V0cyhxdWFsaXR5KSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGlzQWxsb3dlZEZ1bGxRdWFsaXR5ID1cclxuICAgICAgICAgICAgcXVhbGl0eSA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICAgIHF1YWxpdHkgPj0gbnVtUXVhbGl0eUxheWVyc0luVGlsZTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtUXVhbGl0eUxheWVyc1RvUGFyc2U7XHJcbiAgICAgICAgaWYgKCFpc0FsbG93ZWRGdWxsUXVhbGl0eSkge1xyXG4gICAgICAgICAgICBudW1RdWFsaXR5TGF5ZXJzVG9QYXJzZSA9IHF1YWxpdHk7XHJcbiAgICAgICAgfSBlbHNlIGlmICghZGF0YWJpbi5pc0FsbERhdGFiaW5Mb2FkZWQoKSkge1xyXG4gICAgICAgICAgICBudW1RdWFsaXR5TGF5ZXJzVG9QYXJzZSA9IG51bVF1YWxpdHlMYXllcnNJblRpbGU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGVuZE9mZnNldCA9IGRhdGFiaW4uZ2V0RGF0YWJpbkxlbmd0aElmS25vd24oKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBlbmRPZmZzZXQ6IGVuZE9mZnNldCxcclxuICAgICAgICAgICAgICAgIG51bVF1YWxpdHlMYXllcnM6IG51bVF1YWxpdHlMYXllcnNJblRpbGVcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNoZWNrU3VwcG9ydGVkU3RydWN0dXJlKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJ5VmFsaWRhdGVQYWNrZXRzKG51bVF1YWxpdHlMYXllcnNUb1BhcnNlKTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gZ2V0RnVsbFF1YWxpdHlMYXllcnNFbmRPZmZzZXQobnVtUXVhbGl0eUxheWVyc1RvUGFyc2UpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldFBhY2tldE9mZnNldHNCeUNvZGVibG9ja0luZGV4ID0gZnVuY3Rpb24gZ2V0UGFja2V0T2Zmc2V0c0J5Q29kZWJsb2NrSW5kZXgoXHJcbiAgICAgICAgcXVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY2hlY2tTdXBwb3J0ZWRTdHJ1Y3R1cmUoKTtcclxuICAgICAgICB0cnlWYWxpZGF0ZVBhY2tldHMocXVhbGl0eUxheWVyICsgMSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNhbGN1bGF0ZWRMZW5ndGhzLmxlbmd0aCA8PSBxdWFsaXR5TGF5ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBjYWxjdWxhdGVkTGVuZ3Roc1txdWFsaXR5TGF5ZXJdO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gdHJ5VmFsaWRhdGVQYWNrZXRzKHF1YWxpdHlMYXllcnMpIHtcclxuICAgICAgICB3aGlsZSAoY2FsY3VsYXRlZExlbmd0aHMubGVuZ3RoIDwgcXVhbGl0eUxheWVycykge1xyXG4gICAgICAgICAgICBiaXRzdHJlYW1SZWFkZXIuc3RhcnROZXdUcmFuc2FjdGlvbigpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG5leHRQYWNrZXQgPSB0cnlDYWxjdWxhdGVOZXh0UGFja2V0TGVuZ3RoKFxyXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRlZExlbmd0aHMubGVuZ3RoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChuZXh0UGFja2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBiaXRzdHJlYW1SZWFkZXIuYWN0aXZlVHJhbnNhY3Rpb24uYWJvcnQoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FsY3VsYXRlZExlbmd0aHMucHVzaChuZXh0UGFja2V0KTtcclxuICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmFjdGl2ZVRyYW5zYWN0aW9uLmNvbW1pdCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gdHJ5Q2FsY3VsYXRlTmV4dFBhY2tldExlbmd0aChxdWFsaXR5TGF5ZXIpIHtcclxuICAgICAgICB2YXIgaGVhZGVyU3RhcnRPZmZzZXQ7XHJcbiAgICAgICAgaWYgKHF1YWxpdHlMYXllciA+IDApIHtcclxuICAgICAgICAgICAgdmFyIGxhc3QgPSBjYWxjdWxhdGVkTGVuZ3Roc1txdWFsaXR5TGF5ZXIgLSAxXTtcclxuICAgICAgICAgICAgaGVhZGVyU3RhcnRPZmZzZXQgPVxyXG4gICAgICAgICAgICAgICAgbGFzdC5oZWFkZXJTdGFydE9mZnNldCArXHJcbiAgICAgICAgICAgICAgICBsYXN0LmhlYWRlckxlbmd0aCArXHJcbiAgICAgICAgICAgICAgICBsYXN0Lm92ZXJhbGxCb2R5TGVuZ3RoQnl0ZXM7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaGVhZGVyU3RhcnRPZmZzZXQgPSBzdGFydE9mZnNldEluRGF0YWJpbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGJpdHN0cmVhbVJlYWRlci5kYXRhYmluT2Zmc2V0ID0gaGVhZGVyU3RhcnRPZmZzZXQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGlzUGFja2V0SGVhZGVyTmVhckRhdGEgJiYgaXNTdGFydE9mUGFja2V0TWFya2VyQWxsb3dlZCkge1xyXG4gICAgICAgICAgICB2YXIgaXNNYXJrZXIgPSBpc01hcmtlckhlcmUoMHg5MSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoaXNNYXJrZXIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgc3RhcnRPZlBhY2tldFNlZ21lbnRMZW5ndGggPSA2O1xyXG4gICAgICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmRhdGFiaW5PZmZzZXQgKz0gc3RhcnRPZlBhY2tldFNlZ21lbnRMZW5ndGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGlzUGFja2V0RXhpc3RJblF1YWxpdHlMYXllciA9IGJpdHN0cmVhbVJlYWRlci5zaGlmdEJpdCgpO1xyXG4gICAgICAgIGlmIChpc1BhY2tldEV4aXN0SW5RdWFsaXR5TGF5ZXIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghaXNQYWNrZXRFeGlzdEluUXVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgICAgIGJpdHN0cmVhbVJlYWRlci5zaGlmdFJlbWFpbmluZ0JpdHNJbkJ5dGUoKTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGhlYWRlclN0YXJ0T2Zmc2V0OiBoZWFkZXJTdGFydE9mZnNldCxcclxuICAgICAgICAgICAgICAgIGhlYWRlckxlbmd0aDogMSxcclxuICAgICAgICAgICAgICAgIGNvZGVibG9ja0JvZHlMZW5ndGhCeUluZGV4OiBbXSxcclxuICAgICAgICAgICAgICAgIG92ZXJhbGxCb2R5TGVuZ3RoQnl0ZXM6IDBcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBib2R5TGVuZ3RoID0gYWN0dWFsQ2FsY3VsYXRlUGFja2V0TGVuZ3RoQWZ0ZXJaZXJvTGVuZ3RoQml0KFxyXG4gICAgICAgICAgICBxdWFsaXR5TGF5ZXIpO1xyXG4gICAgICAgIGlmIChib2R5TGVuZ3RoID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgaGVhZGVyRW5kT2Zmc2V0ID0gYml0c3RyZWFtUmVhZGVyLmRhdGFiaW5PZmZzZXQ7XHJcbiAgICAgICAgYm9keUxlbmd0aC5oZWFkZXJMZW5ndGggPSBoZWFkZXJFbmRPZmZzZXQgLSBoZWFkZXJTdGFydE9mZnNldDtcclxuXHJcbiAgICAgICAgYm9keUxlbmd0aC5oZWFkZXJTdGFydE9mZnNldCA9IGhlYWRlclN0YXJ0T2Zmc2V0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBib2R5TGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBhY3R1YWxDYWxjdWxhdGVQYWNrZXRMZW5ndGhBZnRlclplcm9MZW5ndGhCaXQocXVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgdmFyIGJvZHlCeXRlcyA9IDA7XHJcbiAgICAgICAgdmFyIGNvZGVibG9ja0JvZHlMZW5ndGhCeUluZGV4ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBzdWJiYW5kID0gMDsgc3ViYmFuZCA8IHN1YmJhbmRQYXJzZXJzLmxlbmd0aDsgKytzdWJiYW5kKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJzZXIgPSBzdWJiYW5kUGFyc2Vyc1tzdWJiYW5kXTtcclxuICAgICAgICAgICAgdmFyIHN1YmJhbmRCb2R5TGVuZ3RoID0gcGFyc2VyLmNhbGN1bGF0ZVN1YmJhbmRMZW5ndGgocXVhbGl0eUxheWVyKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWJiYW5kQm9keUxlbmd0aCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChjb2RlYmxvY2tCb2R5TGVuZ3RoQnlJbmRleCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgY29kZWJsb2NrQm9keUxlbmd0aEJ5SW5kZXggPVxyXG4gICAgICAgICAgICAgICAgICAgIHN1YmJhbmRCb2R5TGVuZ3RoLmNvZGVibG9ja0JvZHlMZW5ndGhCeUluZGV4O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29kZWJsb2NrQm9keUxlbmd0aEJ5SW5kZXggPSBjb2RlYmxvY2tCb2R5TGVuZ3RoQnlJbmRleC5jb25jYXQoXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViYmFuZEJvZHlMZW5ndGguY29kZWJsb2NrQm9keUxlbmd0aEJ5SW5kZXgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBib2R5Qnl0ZXMgKz0gc3ViYmFuZEJvZHlMZW5ndGgub3ZlcmFsbEJvZHlMZW5ndGhCeXRlcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGJpdHN0cmVhbVJlYWRlci5zaGlmdFJlbWFpbmluZ0JpdHNJbkJ5dGUoKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaXNFbmRQYWNrZXRIZWFkZXJNYXJrZXJBbGxvd2VkKSB7XHJcbiAgICAgICAgICAgIHZhciBpc01hcmtlciA9IGlzTWFya2VySGVyZSgweDkyKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChpc01hcmtlciA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNNYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgIHZhciBlbmRQYWNrZXRIZWFkZXJNYXJrZXJMZW5ndGggPSAyO1xyXG4gICAgICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmRhdGFiaW5PZmZzZXQgKz0gZW5kUGFja2V0SGVhZGVyTWFya2VyTGVuZ3RoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGNvZGVibG9ja0JvZHlMZW5ndGhCeUluZGV4OiBjb2RlYmxvY2tCb2R5TGVuZ3RoQnlJbmRleCxcclxuICAgICAgICAgICAgb3ZlcmFsbEJvZHlMZW5ndGhCeXRlczogYm9keUJ5dGVzXHJcbiAgICAgICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEZ1bGxRdWFsaXR5TGF5ZXJzRW5kT2Zmc2V0KHF1YWxpdHkpIHtcclxuICAgICAgICB2YXIgbnVtUGFyc2VkUXVhbGl0eUxheWVyID0gTWF0aC5taW4oXHJcbiAgICAgICAgICAgIHF1YWxpdHksIGNhbGN1bGF0ZWRMZW5ndGhzLmxlbmd0aCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG51bVBhcnNlZFF1YWxpdHlMYXllciA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgZW5kT2Zmc2V0OiBzdGFydE9mZnNldEluRGF0YWJpbixcclxuICAgICAgICAgICAgICAgIG51bVF1YWxpdHlMYXllcnM6IDBcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsYXN0UGFja2V0ID0gY2FsY3VsYXRlZExlbmd0aHNbbnVtUGFyc2VkUXVhbGl0eUxheWVyIC0gMV07XHJcbiAgICAgICAgdmFyIGVuZE9mZnNldCA9XHJcbiAgICAgICAgICAgIGxhc3RQYWNrZXQuaGVhZGVyU3RhcnRPZmZzZXQgK1xyXG4gICAgICAgICAgICBsYXN0UGFja2V0LmhlYWRlckxlbmd0aCArXHJcbiAgICAgICAgICAgIGxhc3RQYWNrZXQub3ZlcmFsbEJvZHlMZW5ndGhCeXRlcztcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICBlbmRPZmZzZXQ6IGVuZE9mZnNldCxcclxuICAgICAgICAgICAgbnVtUXVhbGl0eUxheWVyczogbnVtUGFyc2VkUXVhbGl0eUxheWVyXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gaW5pdFN1YmJhbmRQYXJzZXJzKCkge1xyXG4gICAgICAgIHZhciBudW1TdWJiYW5kcyA9IHByZWNpbmN0LnJlc29sdXRpb25MZXZlbCA9PT0gMCA/IDEgOiAzO1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG51bVN1YmJhbmRzOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIG51bUNvZGVibG9ja3NYSW5TdWJiYW5kO1xyXG4gICAgICAgICAgICB2YXIgbnVtQ29kZWJsb2Nrc1lJblN1YmJhbmQ7XHJcbiAgICAgICAgICAgIGlmIChwcmVjaW5jdC5yZXNvbHV0aW9uTGV2ZWwgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIG51bUNvZGVibG9ja3NYSW5TdWJiYW5kID0gbnVtQ29kZWJsb2Nrc1g7XHJcbiAgICAgICAgICAgICAgICBudW1Db2RlYmxvY2tzWUluU3ViYmFuZCA9IG51bUNvZGVibG9ja3NZO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gVHJlYXQgdGhlIGVkZ2UgY2FzZSBvZiBzaW5nbGUgcmVkdW5kYW50IHBpeGVscyBjb2x1bW5cclxuICAgICAgICAgICAgICAgIC8vIChJbiBvdGhlciBjYXNlcywgbnVtQ29kZWJsb2Nrc1ggaXMgZnVsbCBkdXBsaWNhdGlvbiBvZiAyLlxyXG4gICAgICAgICAgICAgICAgLy8gU2VlIEpwaXBDb21wb25lbnRTdHJ1Y3R1cmUgaW1wbGVtZW50YXRpb24pLlxyXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IDEpIHsgLy8gTEhcclxuICAgICAgICAgICAgICAgICAgICBudW1Db2RlYmxvY2tzWEluU3ViYmFuZCA9IE1hdGguY2VpbChudW1Db2RlYmxvY2tzWCAvIDIpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gSEwgb3IgSEhcclxuICAgICAgICAgICAgICAgICAgICBudW1Db2RlYmxvY2tzWEluU3ViYmFuZCA9IE1hdGguZmxvb3IobnVtQ29kZWJsb2Nrc1ggLyAyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gVHJlYXQgdGhlIGVkZ2UgY2FzZSBvZiBzaW5nbGUgcmVkdW5kYW50IHBpeGVscyByb3dcclxuICAgICAgICAgICAgICAgIC8vIChJbiBvdGhlciBjYXNlcywgbnVtQ29kZWJsb2Nrc1kgaXMgZnVsbCBkdXBsaWNhdGlvbiBvZiAyLlxyXG4gICAgICAgICAgICAgICAgLy8gU2VlIEpwaXBDb21wb25lbnRTdHJ1Y3R1cmUgaW1wbGVtZW50YXRpb24pLlxyXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IDApIHsgLy8gSExcclxuICAgICAgICAgICAgICAgICAgICBudW1Db2RlYmxvY2tzWUluU3ViYmFuZCA9IE1hdGguY2VpbChudW1Db2RlYmxvY2tzWSAvIDIpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gTEggb3IgSEhcclxuICAgICAgICAgICAgICAgICAgICBudW1Db2RlYmxvY2tzWUluU3ViYmFuZCA9IE1hdGguZmxvb3IobnVtQ29kZWJsb2Nrc1kgLyAyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG51bUNvZGVibG9ja3NYSW5TdWJiYW5kID09PSAwIHx8IG51bUNvZGVibG9ja3NZSW5TdWJiYW5kID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmVzdWx0LnB1c2goanBpcEZhY3RvcnkuY3JlYXRlU3ViYmFuZExlbmd0aEluUGFja2V0SGVhZGVyQ2FsY3VsYXRvcihcclxuICAgICAgICAgICAgICAgIGJpdHN0cmVhbVJlYWRlcixcclxuICAgICAgICAgICAgICAgIG51bUNvZGVibG9ja3NYSW5TdWJiYW5kLFxyXG4gICAgICAgICAgICAgICAgbnVtQ29kZWJsb2Nrc1lJblN1YmJhbmQpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJIZXJlKG1hcmtlclNlY29uZEJ5dGUpIHtcclxuICAgICAgICB2YXIgcG9zc2libGVNYXJrZXIgPSBuZXcgQXJyYXkoMik7XHJcbiAgICAgICAgdmFyIGJ5dGVzQ29waWVkID0gZGF0YWJpbi5jb3B5Qnl0ZXMoXHJcbiAgICAgICAgICAgIHBvc3NpYmxlTWFya2VyLFxyXG4gICAgICAgICAgICAvKnJlc3VsdFN0YXJ0T2Zmc2V0PSovMCxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgZGF0YWJpblN0YXJ0T2Zmc2V0OiBiaXRzdHJlYW1SZWFkZXIuZGF0YWJpbk9mZnNldCxcclxuICAgICAgICAgICAgICAgIG1heExlbmd0aFRvQ29weTogMixcclxuICAgICAgICAgICAgICAgIGZvcmNlQ29weUFsbFJhbmdlOiBmYWxzZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGJ5dGVzQ29waWVkKSB7XHJcbiAgICAgICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgICAgICAgIHZhciBpc01hcmtlciA9XHJcbiAgICAgICAgICAgICAgICAgICAgcG9zc2libGVNYXJrZXJbMF0gPT09IDB4RkYgJiZcclxuICAgICAgICAgICAgICAgICAgICBwb3NzaWJsZU1hcmtlclsxXSA9PT0gbWFya2VyU2Vjb25kQnl0ZTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzTWFya2VyO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgaWYgKHBvc3NpYmxlTWFya2VyWzBdID09PSAweEZGKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNoZWNrU3VwcG9ydGVkU3RydWN0dXJlKCkge1xyXG4gICAgICAgIGlmICghaXNQYWNrZXRIZWFkZXJOZWFyRGF0YSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1BQTSBvciBQUFQnLCAnQS43LjQgYW5kIEEuNy41Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSnBpcFF1YWxpdHlMYXllcnNDYWNoZShcclxuICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsIGpwaXBGYWN0b3J5KSB7XHJcbiAgICBcclxuICAgIHZhciBDQUNIRV9LRVkgPSAncGFja2V0TGVuZ3RoQ2FsY3VsYXRvcic7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0UGFja2V0T2Zmc2V0c0J5Q29kZWJsb2NrSW5kZXggPVxyXG4gICAgICAgIGZ1bmN0aW9uIGdldFBhY2tldE9mZnNldHNCeUNvZGVibG9ja0luZGV4KFxyXG4gICAgICAgICAgICBwcmVjaW5jdERhdGFiaW4sIHF1YWxpdHlMYXllciwgcHJlY2luY3RQb3NpdGlvbikge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwYWNrZXRMZW5ndGhDYWxjdWxhdG9yID0gZ2V0UGFja2V0UGFyc2VyKFxyXG4gICAgICAgICAgICBwcmVjaW5jdERhdGFiaW4sIHByZWNpbmN0UG9zaXRpb24pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0gcGFja2V0TGVuZ3RoQ2FsY3VsYXRvci5nZXRQYWNrZXRPZmZzZXRzQnlDb2RlYmxvY2tJbmRleChcclxuICAgICAgICAgICAgcXVhbGl0eUxheWVyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5nZXRRdWFsaXR5TGF5ZXJPZmZzZXQgPSBmdW5jdGlvbiBnZXRRdWFsaXR5TGF5ZXJPZmZzZXQoXHJcbiAgICAgICAgcHJlY2luY3REYXRhYmluLCBxdWFsaXR5LCBwcmVjaW5jdFBvc2l0aW9uKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxvYWRlZFJhbmdlcyA9IHByZWNpbmN0RGF0YWJpbi5nZXRFeGlzdGluZ1JhbmdlcygpO1xyXG4gICAgICAgIHZhciBlbmRPZmZzZXRMb2FkZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHBhY2tldExlbmd0aENhbGN1bGF0b3IgPSBnZXRQYWNrZXRQYXJzZXIoXHJcbiAgICAgICAgICAgIHByZWNpbmN0RGF0YWJpbiwgcHJlY2luY3RQb3NpdGlvbik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGlmIChsb2FkZWRSYW5nZXMubGVuZ3RoIDwgMSB8fCBsb2FkZWRSYW5nZXNbMF0uc3RhcnQgPiAwKSB7XHJcbiAgICAgICAgICAgIGVuZE9mZnNldExvYWRlZCA9IDA7XHJcbiAgICAgICAgICAgIHF1YWxpdHkgPSAwO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGVuZE9mZnNldExvYWRlZCA9IGxvYWRlZFJhbmdlc1swXS5zdGFydCArIGxvYWRlZFJhbmdlc1swXS5sZW5ndGg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsYXllcnNJblByZWNpbmN0ID1cclxuICAgICAgICAgICAgcGFja2V0TGVuZ3RoQ2FsY3VsYXRvci5jYWxjdWxhdGVFbmRPZmZzZXRPZkxhc3RGdWxsUGFja2V0KFxyXG4gICAgICAgICAgICAgICAgcXVhbGl0eSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKGVuZE9mZnNldExvYWRlZCA8IGxheWVyc0luUHJlY2luY3QuZW5kT2Zmc2V0KSB7XHJcbiAgICAgICAgICAgIHZhciByZWR1Y2VkTGF5ZXJzVG9TZWFyY2ggPSBsYXllcnNJblByZWNpbmN0Lm51bVF1YWxpdHlMYXllcnMgLSAxO1xyXG4gICAgICAgICAgICBsYXllcnNJblByZWNpbmN0ID0gcGFja2V0TGVuZ3RoQ2FsY3VsYXRvclxyXG4gICAgICAgICAgICAgICAgLmNhbGN1bGF0ZUVuZE9mZnNldE9mTGFzdEZ1bGxQYWNrZXQocmVkdWNlZExheWVyc1RvU2VhcmNoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGxheWVyc0luUHJlY2luY3Q7XHJcbiAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIGdldFBhY2tldFBhcnNlcihwcmVjaW5jdERhdGFiaW4sIHByZWNpbmN0UG9zaXRpb24pIHtcclxuICAgICAgICB2YXIgcGFja2V0TGVuZ3RoQ2FsY3VsYXRvckNvbnRhaW5lciA9XHJcbiAgICAgICAgICAgIHByZWNpbmN0RGF0YWJpbi5nZXRDYWNoZWREYXRhKENBQ0hFX0tFWSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHBhY2tldExlbmd0aENhbGN1bGF0b3JDb250YWluZXIuY2FsY3VsYXRvciAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYWNrZXRMZW5ndGhDYWxjdWxhdG9yQ29udGFpbmVyLmNhbGN1bGF0b3I7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChwcmVjaW5jdFBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oJ3ByZWNpbmN0UG9zaXRpb24gJyArXHJcbiAgICAgICAgICAgICAgICAnc2hvdWxkIGJlIGdpdmVuIG9uIHRoZSBmaXJzdCB0aW1lIG9mIHVzaW5nIFF1YWxpdHlMYXllcnNDYWNoZSAnICtcclxuICAgICAgICAgICAgICAgICdvbiB0aGlzIHByZWNpbmN0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlU3RydWN0dXJlID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRUaWxlU3RydWN0dXJlKFxyXG4gICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLnRpbGVJbmRleCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvbXBvbmVudFN0cnVjdHVyZSA9IHRpbGVTdHJ1Y3R1cmUuZ2V0Q29tcG9uZW50U3RydWN0dXJlKFxyXG4gICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uLmNvbXBvbmVudCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHBhY2tldExlbmd0aENhbGN1bGF0b3JDb250YWluZXIuY2FsY3VsYXRvciA9XHJcbiAgICAgICAgICAgIGpwaXBGYWN0b3J5LmNyZWF0ZVBhY2tldExlbmd0aENhbGN1bGF0b3IoXHJcbiAgICAgICAgICAgICAgICB0aWxlU3RydWN0dXJlLFxyXG4gICAgICAgICAgICAgICAgY29tcG9uZW50U3RydWN0dXJlLFxyXG4gICAgICAgICAgICAgICAgcHJlY2luY3REYXRhYmluLFxyXG4gICAgICAgICAgICAgICAgLypzdGFydE9mZnNldEluRGF0YWJpbj0qLzAsXHJcbiAgICAgICAgICAgICAgICBwcmVjaW5jdFBvc2l0aW9uKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcGFja2V0TGVuZ3RoQ2FsY3VsYXRvckNvbnRhaW5lci5jYWxjdWxhdG9yO1xyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID1cclxuICAgIGZ1bmN0aW9uIEpwaXBTdWJiYW5kTGVuZ3RoSW5QYWNrZXRIZWFkZXJDYWxjdWxhdG9yKFxyXG4gICAgICAgIGJpdHN0cmVhbVJlYWRlcixcclxuICAgICAgICBudW1Db2RlYmxvY2tzWCxcclxuICAgICAgICBudW1Db2RlYmxvY2tzWSxcclxuICAgICAgICBjb2RpbmdQYXNzZXNOdW1iZXJQYXJzZXIsXHJcbiAgICAgICAgdHJhbnNhY3Rpb25IZWxwZXIsXHJcbiAgICAgICAganBpcEZhY3RvcnkpIHtcclxuICAgIFxyXG4gICAgdmFyIGNvZGVibG9ja0xlbmd0aFBhcnNlcnMgPSBudWxsO1xyXG4gICAgdmFyIGlzQ29kZWJsb2Nrc0luY2x1ZGVkID0gbnVsbDtcclxuICAgIHZhciBwYXJzZWRRdWFsaXR5TGF5ZXJzID0gdHJhbnNhY3Rpb25IZWxwZXIuY3JlYXRlVHJhbnNhY3Rpb25hbE9iamVjdChcclxuICAgICAgICAwLCAvKmlzVmFsdWVUeXBlPSovdHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICB2YXIgaW5jbHVzaW9uVHJlZSA9IGpwaXBGYWN0b3J5LmNyZWF0ZVRhZ1RyZWUoXHJcbiAgICAgICAgYml0c3RyZWFtUmVhZGVyLCBudW1Db2RlYmxvY2tzWCwgbnVtQ29kZWJsb2Nrc1kpO1xyXG4gICAgXHJcbiAgICB2YXIgemVyb0JpdFBsYW5lc1RyZWUgPSBqcGlwRmFjdG9yeS5jcmVhdGVUYWdUcmVlKFxyXG4gICAgICAgIGJpdHN0cmVhbVJlYWRlciwgbnVtQ29kZWJsb2Nrc1gsIG51bUNvZGVibG9ja3NZKTtcclxuICAgIFxyXG4gICAgdGhpcy5jYWxjdWxhdGVTdWJiYW5kTGVuZ3RoID0gZnVuY3Rpb24gY2FsY3VhbHRlU3ViYmFuZExlbmd0aChxdWFsaXR5TGF5ZXIpIHtcclxuICAgICAgICBlbnN1cmVRdWFsaXR5TGF5ZXJOb3RQYXJzZWRZZXQocXVhbGl0eUxheWVyKTtcclxuICAgICAgICBcclxuICAgICAgICBsYXp5SW5pdEFycmF5cygpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGluY2x1c2lvblRyZWUuc2V0TWluaW1hbFZhbHVlSWZOb3RSZWFkQml0cyhxdWFsaXR5TGF5ZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBhY2N1bXVsYXRlZEJvZHlMZW5ndGhCeXRlcyA9IDA7XHJcbiAgICAgICAgdmFyIGNvZGVibG9ja0luZGV4ID0gMDtcclxuICAgICAgICB2YXIgY29kZWJsb2NrTGVuZ3RoQnlJbmRleCA9IG5ldyBBcnJheShudW1Db2RlYmxvY2tzWCAqIG51bUNvZGVibG9ja3NZKTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciB5ID0gMDsgeSA8IG51bUNvZGVibG9ja3NZOyArK3kpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgeCA9IDA7IHggPCBudW1Db2RlYmxvY2tzWDsgKyt4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY29kZWJsb2NrQm9keUxlbmd0aCA9IGdldE5leHRDb2RlYmxvY2tMZW5ndGgoeCwgeSwgcXVhbGl0eUxheWVyKTtcclxuICAgICAgICAgICAgICAgIGlmIChjb2RlYmxvY2tCb2R5TGVuZ3RoID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvZGVibG9ja0xlbmd0aEJ5SW5kZXhbY29kZWJsb2NrSW5kZXgrK10gPSBjb2RlYmxvY2tCb2R5TGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZEJvZHlMZW5ndGhCeXRlcyArPVxyXG4gICAgICAgICAgICAgICAgICAgIGNvZGVibG9ja0JvZHlMZW5ndGguY29kZWJsb2NrQm9keUxlbmd0aEJ5dGVzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHBhcnNlZFF1YWxpdHlMYXllcnMuc2V0VmFsdWUoXHJcbiAgICAgICAgICAgIGJpdHN0cmVhbVJlYWRlci5hY3RpdmVUcmFuc2FjdGlvbiwgcXVhbGl0eUxheWVyICsgMSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY29kZWJsb2NrQm9keUxlbmd0aEJ5SW5kZXg6IGNvZGVibG9ja0xlbmd0aEJ5SW5kZXgsXHJcbiAgICAgICAgICAgIG92ZXJhbGxCb2R5TGVuZ3RoQnl0ZXM6IGFjY3VtdWxhdGVkQm9keUxlbmd0aEJ5dGVzXHJcbiAgICAgICAgICAgIH07XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBlbnN1cmVRdWFsaXR5TGF5ZXJOb3RQYXJzZWRZZXQocXVhbGl0eUxheWVyKSB7XHJcbiAgICAgICAgdmFyIHBhcnNlZFF1YWxpdHlMYXllcnNWYWx1ZSA9IHBhcnNlZFF1YWxpdHlMYXllcnMuZ2V0VmFsdWUoXHJcbiAgICAgICAgICAgIGJpdHN0cmVhbVJlYWRlci5hY3RpdmVUcmFuc2FjdGlvbik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHBhcnNlZFF1YWxpdHlMYXllcnNWYWx1ZSA+PSBxdWFsaXR5TGF5ZXIgKyAxKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgcXVhbGl0eSBsYXllciB0byBwYXJzZScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbGF6eUluaXRBcnJheXMoKSB7XHJcbiAgICAgICAgaWYgKGNvZGVibG9ja0xlbmd0aFBhcnNlcnMgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb2RlYmxvY2tMZW5ndGhQYXJzZXJzID0gbmV3IEFycmF5KG51bUNvZGVibG9ja3NYKTtcclxuICAgICAgICBpc0NvZGVibG9ja3NJbmNsdWRlZCA9IG5ldyBBcnJheShudW1Db2RlYmxvY2tzWCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgeCA9IDA7IHggPCBudW1Db2RlYmxvY2tzWDsgKyt4KSB7XHJcbiAgICAgICAgICAgIGNvZGVibG9ja0xlbmd0aFBhcnNlcnNbeF0gPSBuZXcgQXJyYXkobnVtQ29kZWJsb2Nrc1kpO1xyXG4gICAgICAgICAgICBpc0NvZGVibG9ja3NJbmNsdWRlZFt4XSA9IG5ldyBBcnJheShudW1Db2RlYmxvY2tzWSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciB5ID0gMDsgeSA8IG51bUNvZGVibG9ja3NZOyArK3kpIHtcclxuICAgICAgICAgICAgICAgIGNvZGVibG9ja0xlbmd0aFBhcnNlcnNbeF1beV0gPVxyXG4gICAgICAgICAgICAgICAgICAgIGpwaXBGYWN0b3J5LmNyZWF0ZUNvZGVibG9ja0xlbmd0aFBhcnNlcihcclxuICAgICAgICAgICAgICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLCB0cmFuc2FjdGlvbkhlbHBlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpc0NvZGVibG9ja3NJbmNsdWRlZFt4XVt5XSA9IHRyYW5zYWN0aW9uSGVscGVyXHJcbiAgICAgICAgICAgICAgICAgICAgLmNyZWF0ZVRyYW5zYWN0aW9uYWxPYmplY3QoeyBpc0luY2x1ZGVkOiBmYWxzZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0TmV4dENvZGVibG9ja0xlbmd0aCh4LCB5LCBxdWFsaXR5TGF5ZXIpIHtcclxuICAgICAgICB2YXIgaXNDb2RlYmxvY2tBbHJlYWR5SW5jbHVkZWQgPSBpc0NvZGVibG9ja3NJbmNsdWRlZFt4XVt5XS5nZXRWYWx1ZShcclxuICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaXNDb2RlYmxvY2tJbmNsdWRlZE5vdztcclxuICAgICAgICBpZiAoaXNDb2RlYmxvY2tBbHJlYWR5SW5jbHVkZWQuaXNJbmNsdWRlZCkge1xyXG4gICAgICAgICAgICBpc0NvZGVibG9ja0luY2x1ZGVkTm93ID0gYml0c3RyZWFtUmVhZGVyLnNoaWZ0Qml0KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaXNDb2RlYmxvY2tJbmNsdWRlZE5vdyA9IGluY2x1c2lvblRyZWUuaXNTbWFsbGVyVGhhbk9yRXF1YWxzVG8oXHJcbiAgICAgICAgICAgICAgICB4LCB5LCBxdWFsaXR5TGF5ZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKGlzQ29kZWJsb2NrSW5jbHVkZWROb3cgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfSBlbHNlIGlmICghaXNDb2RlYmxvY2tJbmNsdWRlZE5vdykge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgY29kZWJsb2NrQm9keUxlbmd0aEJ5dGVzOiAwLFxyXG4gICAgICAgICAgICAgICAgY29kaW5nUGFzc2VzOiAwXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgemVyb0JpdFBsYW5lcyA9IG51bGw7XHJcbiAgICAgICAgaWYgKCFpc0NvZGVibG9ja0FscmVhZHlJbmNsdWRlZC5pc0luY2x1ZGVkKSB7XHJcbiAgICAgICAgICAgIHplcm9CaXRQbGFuZXMgPSB6ZXJvQml0UGxhbmVzVHJlZS5nZXRWYWx1ZSh4LCB5KTtcclxuICAgICAgICAgICAgaWYgKHplcm9CaXRQbGFuZXMgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBjb2RpbmdQYXNzZXMgPSBjb2RpbmdQYXNzZXNOdW1iZXJQYXJzZXIucGFyc2UoYml0c3RyZWFtUmVhZGVyKTtcclxuICAgICAgICBpZiAoY29kaW5nUGFzc2VzID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgbGVuZ3RoUGFyc2VyID0gY29kZWJsb2NrTGVuZ3RoUGFyc2Vyc1t4XVt5XTtcclxuICAgICAgICB2YXIgYm9keUxlbmd0aEJ5dGVzID0gbGVuZ3RoUGFyc2VyLnBhcnNlKGNvZGluZ1Bhc3Nlcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGJvZHlMZW5ndGhCeXRlcyA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaXNDb2RlYmxvY2tBbHJlYWR5SW5jbHVkZWQuaXNJbmNsdWRlZCA9IHRydWU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgY29kZWJsb2NrQm9keUxlbmd0aEJ5dGVzOiBib2R5TGVuZ3RoQnl0ZXMsXHJcbiAgICAgICAgICAgIGNvZGluZ1Bhc3NlczogY29kaW5nUGFzc2VzXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHplcm9CaXRQbGFuZXMgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmVzdWx0Lnplcm9CaXRQbGFuZXMgPSB6ZXJvQml0UGxhbmVzO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSnBpcFRhZ1RyZWUoXHJcbiAgICBiaXRzdHJlYW1SZWFkZXIsIHdpZHRoLCBoZWlnaHQsIHRyYW5zYWN0aW9uSGVscGVyKSB7XHJcbiAgICBcclxuICAgIHZhciBpc0FscmVhZHlSZWFkQml0c1RyYW5zYWN0aW9uYWxPYmplY3QgPVxyXG4gICAgICAgIHRyYW5zYWN0aW9uSGVscGVyLmNyZWF0ZVRyYW5zYWN0aW9uYWxPYmplY3QoZmFsc2UsIC8qaXNWYWx1ZVR5cGU9Ki90cnVlKTtcclxuICAgIHZhciBsZXZlbHM7XHJcbiAgICBcclxuICAgIGNyZWF0ZUxldmVsc0FycmF5KCk7XHJcbiAgICAgICAgXHJcbiAgICB0aGlzLnNldE1pbmltYWxWYWx1ZUlmTm90UmVhZEJpdHMgPSBmdW5jdGlvbiBzZXRNaW5pbWFsVmFsdWVJZk5vdFJlYWRCaXRzKFxyXG4gICAgICAgIG1pbmltYWxWYWx1ZSkge1xyXG4gICAgXHJcbiAgICAgICAgaWYgKGlzQWxyZWFkeVJlYWRCaXRzKCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgdHJhbnNhY3Rpb25hbE9iamVjdCA9IGxldmVsc1swXS5jb250ZW50WzBdO1xyXG4gICAgICAgIHZhciBub2RlID0gdHJhbnNhY3Rpb25hbE9iamVjdC5nZXRWYWx1ZShcclxuICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICBcclxuICAgICAgICBub2RlLm1pbmltYWxQb3NzaWJsZVZhbHVlID0gbWluaW1hbFZhbHVlO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5pc1NtYWxsZXJUaGFuT3JFcXVhbHNUbyA9IGZ1bmN0aW9uIGlzU21hbGxlclRoYW5PckVxdWFsc1RvKFxyXG4gICAgICAgIHgsIHksIHZhbHVlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2V0QWxyZWFkeVJlYWRCaXRzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGdldE5leHROb2RlID0gZ2V0Um9vdFRvTGVhZkl0ZXJhdG9yKHgsIHkpO1xyXG4gICAgICAgIHZhciBjdXJyZW50Tm9kZSA9IGdldE5leHROb2RlKCk7XHJcbiAgICAgICAgdmFyIGxhc3ROb2RlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHdoaWxlIChjdXJyZW50Tm9kZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudE5vZGUubWluaW1hbFBvc3NpYmxlVmFsdWUgPiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnROb2RlLmlzRmluYWxWYWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG1heEJpdHNUb1NoaWZ0ID0gdmFsdWUgLSBjdXJyZW50Tm9kZS5taW5pbWFsUG9zc2libGVWYWx1ZSArIDE7XHJcbiAgICAgICAgICAgICAgICB2YXIgYWRkVG9WYWx1ZSA9IGJpdHN0cmVhbVJlYWRlci5jb3VudFplcm9zQW5kU2hpZnRVbnRpbEZpcnN0T25lQml0KFxyXG4gICAgICAgICAgICAgICAgICAgIG1heEJpdHNUb1NoaWZ0KTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChhZGRUb1ZhbHVlID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGN1cnJlbnROb2RlLm1pbmltYWxQb3NzaWJsZVZhbHVlICs9IGFkZFRvVmFsdWU7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChhZGRUb1ZhbHVlIDwgbWF4Qml0c1RvU2hpZnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50Tm9kZS5pc0ZpbmFsVmFsdWUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsYXN0Tm9kZSA9IGN1cnJlbnROb2RlO1xyXG4gICAgICAgICAgICBjdXJyZW50Tm9kZSA9IGdldE5leHROb2RlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByZXN1bHQgPSBsYXN0Tm9kZS5taW5pbWFsUG9zc2libGVWYWx1ZSA8PSB2YWx1ZTtcclxuICAgICAgICBpZiAocmVzdWx0ICYmICFsYXN0Tm9kZS5pc0ZpbmFsVmFsdWUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAnV3JvbmcgcGFyc2luZyBpbiBUYWdUcmVlLmlzU21hbGxlclRoYW5PckVxdWFsc1RvOiAnICtcclxuICAgICAgICAgICAgICAgICdub3Qgc3VyZSBpZiB2YWx1ZSBpcyBzbWFsbGVyIHRoYW4gYXNrZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0VmFsdWUgPSBmdW5jdGlvbiBnZXRWYWx1ZSh4LCB5KSB7XHJcbiAgICAgICAgdmFyIGdldE5leHROb2RlID0gZ2V0Um9vdFRvTGVhZkl0ZXJhdG9yKHgsIHkpO1xyXG4gICAgICAgIHZhciBjdXJyZW50Tm9kZSA9IGdldE5leHROb2RlKCk7XHJcbiAgICAgICAgdmFyIGxlYWY7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2V0QWxyZWFkeVJlYWRCaXRzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKGN1cnJlbnROb2RlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGlmICghY3VycmVudE5vZGUuaXNGaW5hbFZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYWRkVG9WYWx1ZSA9XHJcbiAgICAgICAgICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmNvdW50WmVyb3NBbmRTaGlmdFVudGlsRmlyc3RPbmVCaXQoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGFkZFRvVmFsdWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50Tm9kZS5taW5pbWFsUG9zc2libGVWYWx1ZSArPSBhZGRUb1ZhbHVlO1xyXG4gICAgICAgICAgICAgICAgY3VycmVudE5vZGUuaXNGaW5hbFZhbHVlID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGVhZiA9IGN1cnJlbnROb2RlO1xyXG4gICAgICAgICAgICBjdXJyZW50Tm9kZSA9IGdldE5leHROb2RlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBsZWFmLm1pbmltYWxQb3NzaWJsZVZhbHVlO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGV2ZWxzQXJyYXkoKSB7XHJcbiAgICAgICAgbGV2ZWxzID0gW107XHJcbiAgICAgICAgdmFyIGxldmVsV2lkdGggPSB3aWR0aDtcclxuICAgICAgICB2YXIgbGV2ZWxIZWlnaHQgPSBoZWlnaHQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKGxldmVsV2lkdGggPj0gMSB8fCBsZXZlbEhlaWdodCA+PSAxKSB7XHJcbiAgICAgICAgICAgIGxldmVsV2lkdGggPSBNYXRoLmNlaWwobGV2ZWxXaWR0aCk7XHJcbiAgICAgICAgICAgIGxldmVsSGVpZ2h0ID0gTWF0aC5jZWlsKGxldmVsSGVpZ2h0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBlbGVtZW50Q291bnQgPSBsZXZlbFdpZHRoICogbGV2ZWxIZWlnaHQ7XHJcbiAgICAgICAgICAgIGxldmVscy51bnNoaWZ0KHtcclxuICAgICAgICAgICAgICAgIHdpZHRoOiBsZXZlbFdpZHRoLFxyXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBsZXZlbEhlaWdodCxcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG5ldyBBcnJheShlbGVtZW50Q291bnQpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxldmVsV2lkdGggLz0gMjtcclxuICAgICAgICAgICAgbGV2ZWxIZWlnaHQgLz0gMjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaW5pdE5vZGUoMCwgMCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldFJvb3RUb0xlYWZJdGVyYXRvcih4LCB5KSB7XHJcbiAgICAgICAgdmFyIGxldmVsID0gMDtcclxuICAgICAgICB2YXIgcHJldkl0ZXJhdGVkTm9kZSA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gZ2V0TmV4dCgpIHtcclxuICAgICAgICAgICAgaWYgKGxldmVsID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAnSXRlcmF0ZWQgdG9vIGRlZXAgaW4gdGFnIHRyZWUnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGxldmVsID09PSBsZXZlbHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBsZXZlbCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHNoaWZ0RmFjdG9yID0gbGV2ZWxzLmxlbmd0aCAtIGxldmVsIC0gMTtcclxuICAgICAgICAgICAgdmFyIGN1cnJlbnRYID0gTWF0aC5mbG9vcih4ID4+IHNoaWZ0RmFjdG9yKTtcclxuICAgICAgICAgICAgdmFyIGN1cnJlbnRZID0gTWF0aC5mbG9vcih5ID4+IHNoaWZ0RmFjdG9yKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBpbmRleEluTGV2ZWwgPSBsZXZlbHNbbGV2ZWxdLndpZHRoICogY3VycmVudFkgKyBjdXJyZW50WDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciB0cmFuc2FjdGlvbmFsT2JqZWN0ID0gbGV2ZWxzW2xldmVsXS5jb250ZW50W2luZGV4SW5MZXZlbF07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodHJhbnNhY3Rpb25hbE9iamVjdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0cmFuc2FjdGlvbmFsT2JqZWN0ID0gaW5pdE5vZGUobGV2ZWwsIGluZGV4SW5MZXZlbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB0cmFuc2FjdGlvbmFsT2JqZWN0LmdldFZhbHVlKFxyXG4gICAgICAgICAgICAgICAgYml0c3RyZWFtUmVhZGVyLmFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChwcmV2SXRlcmF0ZWROb2RlICE9PSBudWxsICYmXHJcbiAgICAgICAgICAgICAgICBwcmV2SXRlcmF0ZWROb2RlLm1pbmltYWxQb3NzaWJsZVZhbHVlID4gcmVzdWx0Lm1pbmltYWxQb3NzaWJsZVZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5taW5pbWFsUG9zc2libGVWYWx1ZSA9IHByZXZJdGVyYXRlZE5vZGUubWluaW1hbFBvc3NpYmxlVmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHByZXZJdGVyYXRlZE5vZGUgPSByZXN1bHQ7XHJcbiAgICAgICAgICAgICsrbGV2ZWw7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBnZXROZXh0O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBpbml0Tm9kZShsZXZlbCwgaW5kZXhJbkxldmVsKSB7XHJcbiAgICAgICAgdmFyIG9iamVjdFZhbHVlID0ge1xyXG4gICAgICAgICAgICBtaW5pbWFsUG9zc2libGVWYWx1ZTogMCxcclxuICAgICAgICAgICAgaXNGaW5hbFZhbHVlOiBmYWxzZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB2YXIgdHJhbnNhY3Rpb25hbE9iamVjdCA9IHRyYW5zYWN0aW9uSGVscGVyLmNyZWF0ZVRyYW5zYWN0aW9uYWxPYmplY3QoXHJcbiAgICAgICAgICAgIG9iamVjdFZhbHVlKTtcclxuICAgICAgICBcclxuICAgICAgICBsZXZlbHNbbGV2ZWxdLmNvbnRlbnRbaW5kZXhJbkxldmVsXSA9IHRyYW5zYWN0aW9uYWxPYmplY3Q7XHJcbiAgICAgICAgcmV0dXJuIHRyYW5zYWN0aW9uYWxPYmplY3Q7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGlzQWxyZWFkeVJlYWRCaXRzKCkge1xyXG4gICAgICAgIHZhciBpc0FscmVhZHlSZWFkQml0c1RyYW5zYWN0aW9uYWxWYWx1ZSA9XHJcbiAgICAgICAgICAgIGlzQWxyZWFkeVJlYWRCaXRzVHJhbnNhY3Rpb25hbE9iamVjdC5nZXRWYWx1ZShcclxuICAgICAgICAgICAgICAgIGJpdHN0cmVhbVJlYWRlci5hY3RpdmVUcmFuc2FjdGlvbik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGlzQWxyZWFkeVJlYWRCaXRzVHJhbnNhY3Rpb25hbFZhbHVlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXRBbHJlYWR5UmVhZEJpdHMoKSB7XHJcbiAgICAgICAgaXNBbHJlYWR5UmVhZEJpdHNUcmFuc2FjdGlvbmFsT2JqZWN0LnNldFZhbHVlKFxyXG4gICAgICAgICAgICBiaXRzdHJlYW1SZWFkZXIuYWN0aXZlVHJhbnNhY3Rpb24sIHRydWUpO1xyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBqR2xvYmFscyA9IHJlcXVpcmUoJ2oyay1qcGlwLWdsb2JhbHMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgY3JlYXRlVHJhbnNhY3Rpb246IGZ1bmN0aW9uIGNyZWF0ZVRyYW5zYWN0aW9uKCkge1xyXG4gICAgICAgIC8vIFRoaXMgY29kZSBpcyBleGVjdXRlZCBhIExPVC4gRm9yIG9wdGltaXphdGlvbiwgc3RhdGUgaXMgcmVwcmVzZW50ZWRcclxuICAgICAgICAvLyBkaXJlY3RseSBhcyBudW1iZXJzIChJIGNvdWxkbid0IHRoaW5rIGFib3V0IG1vcmUgcmVhZGFibGUgd2F5IHdoaWNoXHJcbiAgICAgICAgLy8gaXMgcGVyZm9ybWFuY2UtZXF1aXZhbGVudCkuXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gc3RhdGUgPSAxID09PiBUcmFuc2FjdGlvbiBpcyBhY3RpdmVcclxuICAgICAgICAvLyBzdGF0ZSA9IDIgPT0+IFRyYW5zYWN0aW9uIGhhcyBjb21taXR0ZWQgc3VjY2Vzc2Z1bGx5XHJcbiAgICAgICAgLy8gc3RhdGUgPSAzID09PiBUcmFuc2FjdGlvbiBoYXMgYmVlbiBhYm9ydGVkXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN0YXRlID0gMTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgdHJhbnNhY3Rpb24gPSB7XHJcbiAgICAgICAgICAgIGdldCBpc0Fib3J0ZWQoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUgPT09IDM7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBnZXQgaXNBY3RpdmUoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUgPT09IDE7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb21taXQ6IGZ1bmN0aW9uIGNvbW1pdCgpIHtcclxuICAgICAgICAgICAgICAgIHRlcm1pbmF0ZSh0cnVlKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICBcclxuICAgICAgICAgICAgYWJvcnQ6IGZ1bmN0aW9uIGFib3J0KCkge1xyXG4gICAgICAgICAgICAgICAgdGVybWluYXRlKGZhbHNlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gdGVybWluYXRlKGlzU3VjY2Vzc2Z1bF8pIHtcclxuICAgICAgICAgICAgaWYgKCF0cmFuc2FjdGlvbi5pc0FjdGl2ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zLkludGVybmFsRXJyb3JFeGNlcHRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgJ0Nhbm5vdCB0ZXJtaW5hdGUgYW4gYWxyZWFkeSB0ZXJtaW5hdGVkIHRyYW5zYWN0aW9uJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc3RhdGUgPSBpc1N1Y2Nlc3NmdWxfID8gMiA6IDM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICByZXR1cm4gdHJhbnNhY3Rpb247XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBjcmVhdGVUcmFuc2FjdGlvbmFsT2JqZWN0OiBmdW5jdGlvbiBjb21taXRUcmFuc2FjdGlvbihcclxuICAgICAgICBpbml0aWFsVmFsdWUsIGlzVmFsdWVUeXBlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHZhbHVlID0gbnVsbDtcclxuICAgICAgICB2YXIgcHJldlZhbHVlID0gaW5pdGlhbFZhbHVlO1xyXG4gICAgICAgIHZhciBsYXN0QWNjZXNzZWRUcmFuc2FjdGlvbiA9IHtcclxuICAgICAgICAgICAgaXNBY3RpdmU6IGZhbHNlLFxyXG4gICAgICAgICAgICBpc0Fib3J0ZWQ6IHRydWVcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB2YXIgY2xvbmUgPSBpc1ZhbHVlVHlwZSA/IGNsb25lVmFsdWVUeXBlIDogY2xvbmVCeUpTT047XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRyYW5zYWN0aW9uYWxPYmplY3QgPSB7XHJcbiAgICAgICAgICAgIGdldFZhbHVlOiBmdW5jdGlvbiBnZXRWYWx1ZShhY3RpdmVUcmFuc2FjdGlvbikge1xyXG4gICAgICAgICAgICAgICAgZW5zdXJlQWxsb3dlZEFjY2VzcyhhY3RpdmVUcmFuc2FjdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGxhc3RBY2Nlc3NlZFRyYW5zYWN0aW9uID09PSBhY3RpdmVUcmFuc2FjdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGxhc3RBY2Nlc3NlZFRyYW5zYWN0aW9uLmlzQWJvcnRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gY2xvbmUocHJldlZhbHVlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldlZhbHVlID0gY2xvbmUodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGxhc3RBY2Nlc3NlZFRyYW5zYWN0aW9uID0gYWN0aXZlVHJhbnNhY3Rpb247XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzZXRWYWx1ZTogZnVuY3Rpb24gc2V0VmFsdWUoYWN0aXZlVHJhbnNhY3Rpb24sIG5ld1ZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICBlbnN1cmVBbGxvd2VkQWNjZXNzKGFjdGl2ZVRyYW5zYWN0aW9uKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAobGFzdEFjY2Vzc2VkVHJhbnNhY3Rpb24gPT09IGFjdGl2ZVRyYW5zYWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBuZXdWYWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICghbGFzdEFjY2Vzc2VkVHJhbnNhY3Rpb24uaXNBYm9ydGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldlZhbHVlID0gY2xvbmUodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBsYXN0QWNjZXNzZWRUcmFuc2FjdGlvbiA9IGFjdGl2ZVRyYW5zYWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBuZXdWYWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gZW5zdXJlQWxsb3dlZEFjY2VzcyhhY3RpdmVUcmFuc2FjdGlvbikge1xyXG4gICAgICAgICAgICBpZiAoIWFjdGl2ZVRyYW5zYWN0aW9uLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAnQ2Fubm90IHVzZSB0ZXJtaW5hdGVkIHRyYW5zYWN0aW9uIHRvIGFjY2VzcyBvYmplY3RzJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChhY3RpdmVUcmFuc2FjdGlvbiAhPT0gbGFzdEFjY2Vzc2VkVHJhbnNhY3Rpb24gJiZcclxuICAgICAgICAgICAgICAgIGxhc3RBY2Nlc3NlZFRyYW5zYWN0aW9uLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBqR2xvYmFscy5qcGlwRXhjZXB0aW9ucy5JbnRlcm5hbEVycm9yRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICdDYW5ub3Qgc2ltdWx0YW5vdXNseSBhY2Nlc3MgdHJhbnNhY3Rpb25hbCBvYmplY3QgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgJ2Zyb20gdHdvIGFjdGl2ZSB0cmFuc2FjdGlvbnMnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBmdW5jdGlvbiBjbG9uZVZhbHVlVHlwZSh2YWx1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGZ1bmN0aW9uIGNsb25lQnlKU09OKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIHZhciBuZXdWYWx1ZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodmFsdWUpKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ld1ZhbHVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdHJhbnNhY3Rpb25hbE9iamVjdDtcclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5KcGlwSW1hZ2UgPSByZXF1aXJlKCdqcGlwLWltYWdlLmpzJyk7XHJcbm1vZHVsZS5leHBvcnRzLlBkZmpzSnB4RGVjb2RlciA9IHJlcXVpcmUoJ3BkZmpzLWpweC1kZWNvZGVyLmpzJyk7XHJcbm1vZHVsZS5leHBvcnRzLmoya0V4Y2VwdGlvbnMgPSBqR2xvYmFscy5qMmtFeGNlcHRpb25zO1xyXG5tb2R1bGUuZXhwb3J0cy5qcGlwRXhjZXB0aW9ucyA9IGpHbG9iYWxzLmpwaXBFeGNlcHRpb25zO1xyXG5tb2R1bGUuZXhwb3J0cy5JbnRlcm5hbHMgPSB7XHJcbiAgICBqcGlwUnVudGltZUZhY3Rvcnk6IHJlcXVpcmUoJ2pwaXAtcnVudGltZS1mYWN0b3J5LmpzJyksXHJcbiAgICBqR2xvYmFsczogakdsb2JhbHNcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBDb2Rlc3RyZWFtUmVjb25zdHJ1Y3RvcihcclxuICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsXHJcbiAgICBkYXRhYmluc1NhdmVyLFxyXG4gICAgaGVhZGVyTW9kaWZpZXIsXHJcbiAgICBxdWFsaXR5TGF5ZXJzQ2FjaGUpIHtcclxuICAgIFxyXG4gICAgdGhpcy5yZWNvbnN0cnVjdENvZGVzdHJlYW0gPSBmdW5jdGlvbiByZWNvbnN0cnVjdENvZGVzdHJlYW0oXHJcbiAgICAgICAgbWluTnVtUXVhbGl0eUxheWVycykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcclxuICAgICAgICB2YXIgY3VycmVudE9mZnNldCA9IGNyZWF0ZU1haW5IZWFkZXIocmVzdWx0KTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoY3VycmVudE9mZnNldCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG51bVRpbGVzID1cclxuICAgICAgICAgICAgY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1UaWxlc1goKSAqIGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0TnVtVGlsZXNZKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvZGVzdHJlYW1QYXJ0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChtaW5OdW1RdWFsaXR5TGF5ZXJzID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgbWluTnVtUXVhbGl0eUxheWVycyA9ICdtYXgnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciB0aWxlSWQgPSAwOyB0aWxlSWQgPCBudW1UaWxlczsgKyt0aWxlSWQpIHtcclxuICAgICAgICAgICAgdmFyIHRpbGVCeXRlc0NvcGllZCA9IGNyZWF0ZVRpbGUoXHJcbiAgICAgICAgICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50T2Zmc2V0LFxyXG4gICAgICAgICAgICAgICAgdGlsZUlkLFxyXG4gICAgICAgICAgICAgICAgdGlsZUlkLFxyXG4gICAgICAgICAgICAgICAgY29kZXN0cmVhbVBhcnQsXHJcbiAgICAgICAgICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQgKz0gdGlsZUJ5dGVzQ29waWVkO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRpbGVCeXRlc0NvcGllZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1hcmtlckJ5dGVzQ29waWVkID0gY29weUJ5dGVzKFxyXG4gICAgICAgICAgICByZXN1bHQsIGN1cnJlbnRPZmZzZXQsIGpHbG9iYWxzLmoya01hcmtlcnMuRW5kT2ZDb2Rlc3RyZWFtKTtcclxuICAgICAgICBjdXJyZW50T2Zmc2V0ICs9IG1hcmtlckJ5dGVzQ29waWVkO1xyXG4gICAgICAgIHJlc3VsdC5sZW5ndGggPSBjdXJyZW50T2Zmc2V0O1xyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5jcmVhdGVDb2Rlc3RyZWFtRm9yUmVnaW9uID0gZnVuY3Rpb24gY3JlYXRlQ29kZXN0cmVhbUZvclJlZ2lvbihcclxuICAgICAgICBwYXJhbXMsIG1pbk51bVF1YWxpdHlMYXllcnMsIGlzT25seUhlYWRlcnNXaXRob3V0Qml0c3RyZWFtKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvZGVzdHJlYW0gPSBbXTtcclxuICAgICAgICB2YXIgY3VycmVudE9mZnNldCA9IGNyZWF0ZU1haW5IZWFkZXIoXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW0sIHBhcmFtcy5sZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGN1cnJlbnRPZmZzZXQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlSWRUb1dyaXRlID0gMDtcclxuICAgICAgICB2YXIgdGlsZUl0ZXJhdG9yID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRUaWxlc0l0ZXJhdG9yKHBhcmFtcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZpcnN0VGlsZUlkID0gdGlsZUl0ZXJhdG9yLnRpbGVJbmRleDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZmlyc3RUaWxlTGVmdCA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0VGlsZUxlZnQoXHJcbiAgICAgICAgICAgIGZpcnN0VGlsZUlkLCBwYXJhbXMubGV2ZWwpO1xyXG4gICAgICAgIHZhciBmaXJzdFRpbGVUb3AgPSBjb2Rlc3RyZWFtU3RydWN0dXJlLmdldFRpbGVUb3AoXHJcbiAgICAgICAgICAgIGZpcnN0VGlsZUlkLCBwYXJhbXMubGV2ZWwpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB2YXIgb2Zmc2V0WCA9IHBhcmFtcy5taW5YIC0gZmlyc3RUaWxlTGVmdDtcclxuICAgICAgICB2YXIgb2Zmc2V0WSA9IHBhcmFtcy5taW5ZIC0gZmlyc3RUaWxlVG9wO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgdmFyIHRpbGVJZE9yaWdpbmFsID0gdGlsZUl0ZXJhdG9yLnRpbGVJbmRleDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciB0aWxlQnl0ZXNDb3BpZWQgPSBjcmVhdGVUaWxlKFxyXG4gICAgICAgICAgICAgICAgY29kZXN0cmVhbSxcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQsXHJcbiAgICAgICAgICAgICAgICB0aWxlSWRUb1dyaXRlKyssXHJcbiAgICAgICAgICAgICAgICB0aWxlSWRPcmlnaW5hbCxcclxuICAgICAgICAgICAgICAgIHBhcmFtcyxcclxuICAgICAgICAgICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnMsXHJcbiAgICAgICAgICAgICAgICBpc09ubHlIZWFkZXJzV2l0aG91dEJpdHN0cmVhbSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgY3VycmVudE9mZnNldCArPSB0aWxlQnl0ZXNDb3BpZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aWxlQnl0ZXNDb3BpZWQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSB3aGlsZSAodGlsZUl0ZXJhdG9yLnRyeUFkdmFuY2UoKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1hcmtlckJ5dGVzQ29waWVkID0gY29weUJ5dGVzKFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtLCBjdXJyZW50T2Zmc2V0LCBqR2xvYmFscy5qMmtNYXJrZXJzLkVuZE9mQ29kZXN0cmVhbSk7XHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSBtYXJrZXJCeXRlc0NvcGllZDtcclxuXHJcbiAgICAgICAgaGVhZGVyTW9kaWZpZXIubW9kaWZ5SW1hZ2VTaXplKGNvZGVzdHJlYW0sIHBhcmFtcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGNvZGVzdHJlYW0gPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvZGVzdHJlYW0ubGVuZ3RoID0gY3VycmVudE9mZnNldDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY29kZXN0cmVhbTogY29kZXN0cmVhbSxcclxuICAgICAgICAgICAgb2Zmc2V0WDogb2Zmc2V0WCxcclxuICAgICAgICAgICAgb2Zmc2V0WTogb2Zmc2V0WVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5jcmVhdGVDb2Rlc3RyZWFtRm9yVGlsZSA9IGZ1bmN0aW9uIGNyZWF0ZUNvZGVzdHJlYW1Gb3JUaWxlKFxyXG4gICAgICAgIHRpbGVJZCxcclxuICAgICAgICBsZXZlbCxcclxuICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzLFxyXG4gICAgICAgIHF1YWxpdHkpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmVzdWx0ID0gW107XHJcbiAgICAgICAgdmFyIGN1cnJlbnRPZmZzZXQgPSBjcmVhdGVNYWluSGVhZGVyKHJlc3VsdCwgbGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjdXJyZW50T2Zmc2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBUT0RPOiBEZWxldGUgdGhpcyBmdW5jdGlvbiBhbmQgdGVzdCBjcmVhdGVDb2Rlc3RyZWFtRm9yUmVnaW9uIGluc3RlYWRcclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29kZXN0cmVhbVBhcnRQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbCxcclxuICAgICAgICAgICAgcXVhbGl0eTogcXVhbGl0eVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlQnl0ZXNDb3BpZWQgPSBjcmVhdGVUaWxlKFxyXG4gICAgICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQsXHJcbiAgICAgICAgICAgIC8qdGlsZUlkVG9Xcml0ZT0qLzAsXHJcbiAgICAgICAgICAgIC8qdGlsZUlkT3JpZ2luYWw9Ki90aWxlSWQsXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgICAgICBtaW5OdW1RdWFsaXR5TGF5ZXJzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSB0aWxlQnl0ZXNDb3BpZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRpbGVCeXRlc0NvcGllZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBtYXJrZXJCeXRlc0NvcGllZCA9IGNvcHlCeXRlcyhcclxuICAgICAgICAgICAgcmVzdWx0LCBjdXJyZW50T2Zmc2V0LCBqR2xvYmFscy5qMmtNYXJrZXJzLkVuZE9mQ29kZXN0cmVhbSk7XHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSBtYXJrZXJCeXRlc0NvcGllZDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtVGlsZXNYID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXROdW1UaWxlc1goKTtcclxuICAgICAgICB2YXIgdGlsZVggPSB0aWxlSWQgJSBudW1UaWxlc1g7XHJcbiAgICAgICAgdmFyIHRpbGVZID0gTWF0aC5mbG9vcih0aWxlSWQgLyBudW1UaWxlc1gpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGhlYWRlck1vZGlmaWVyLm1vZGlmeUltYWdlU2l6ZShyZXN1bHQsIHtcclxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsLFxyXG4gICAgICAgICAgICBtaW5UaWxlWDogdGlsZVgsXHJcbiAgICAgICAgICAgIG1heFRpbGVYRXhjbHVzaXZlOiB0aWxlWCArIDEsXHJcbiAgICAgICAgICAgIG1pblRpbGVZOiB0aWxlWSxcclxuICAgICAgICAgICAgbWF4VGlsZVlFeGNsdXNpdmU6IHRpbGVZICsgMVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXN1bHQubGVuZ3RoID0gY3VycmVudE9mZnNldDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTWFpbkhlYWRlcihyZXN1bHQsIGxldmVsKSB7XHJcbiAgICAgICAgaWYgKGRhdGFiaW5zU2F2ZXIuZ2V0SXNKcGlwVGlsZVBhcnRTdHJlYW0oKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuVW5zdXBwb3J0ZWRGZWF0dXJlRXhjZXB0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ3JlY29uc3RydWN0aW9uIG9mIGNvZGVzdHJlYW0gZnJvbSBKUFQgKEpwaXAgVGlsZS1wYXJ0KSBzdHJlYW0nLCAnQS4zLjQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1haW5IZWFkZXIgPSBkYXRhYmluc1NhdmVyLmdldE1haW5IZWFkZXJEYXRhYmluKCk7XHJcbiAgICAgICAgdmFyIGN1cnJlbnRPZmZzZXQgPSBtYWluSGVhZGVyLmNvcHlCeXRlcyhyZXN1bHQsIC8qc3RhcnRPZmZzZXQ9Ki8wLCB7XHJcbiAgICAgICAgICAgIGZvcmNlQ29weUFsbFJhbmdlOiB0cnVlXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjdXJyZW50T2Zmc2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXNBZGRlZCA9IGhlYWRlck1vZGlmaWVyLm1vZGlmeU1haW5PclRpbGVIZWFkZXIoXHJcbiAgICAgICAgICAgIHJlc3VsdCwgbWFpbkhlYWRlciwgLypvZmZzZXQ9Ki8wLCBsZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSBieXRlc0FkZGVkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGJ5dGVzQWRkZWQgPSBhZGRNYW1hemF2Q29tbWVudChyZXN1bHQsIGN1cnJlbnRPZmZzZXQpO1xyXG4gICAgICAgIGN1cnJlbnRPZmZzZXQgKz0gYnl0ZXNBZGRlZDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gY3VycmVudE9mZnNldDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlVGlsZShcclxuICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgY3VycmVudE9mZnNldCxcclxuICAgICAgICB0aWxlSWRUb1dyaXRlLFxyXG4gICAgICAgIHRpbGVJZE9yaWdpbmFsLFxyXG4gICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLFxyXG4gICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnMsXHJcbiAgICAgICAgaXNPbmx5SGVhZGVyc1dpdGhvdXRCaXRzdHJlYW0pIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgdGlsZVN0cnVjdHVyZSA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0VGlsZVN0cnVjdHVyZShcclxuICAgICAgICAgICAgdGlsZUlkT3JpZ2luYWwpO1xyXG5cclxuICAgICAgICB2YXIgc3RhcnRUaWxlT2Zmc2V0ID0gY3VycmVudE9mZnNldDtcclxuICAgICAgICB2YXIgdGlsZUhlYWRlckRhdGFiaW4gPSBkYXRhYmluc1NhdmVyLmdldFRpbGVIZWFkZXJEYXRhYmluKFxyXG4gICAgICAgICAgICB0aWxlSWRPcmlnaW5hbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxldmVsO1xyXG4gICAgICAgIGlmIChjb2Rlc3RyZWFtUGFydFBhcmFtcyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIGxldmVsID0gY29kZXN0cmVhbVBhcnRQYXJhbXMubGV2ZWw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlSGVhZGVyT2Zmc2V0cyA9IGNyZWF0ZVRpbGVIZWFkZXJBbmRHZXRPZmZzZXRzKFxyXG4gICAgICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQsXHJcbiAgICAgICAgICAgIHRpbGVIZWFkZXJEYXRhYmluLFxyXG4gICAgICAgICAgICB0aWxlSWRUb1dyaXRlLFxyXG4gICAgICAgICAgICBsZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRpbGVIZWFkZXJPZmZzZXRzID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY3VycmVudE9mZnNldCA9IHRpbGVIZWFkZXJPZmZzZXRzLmVuZFRpbGVIZWFkZXJPZmZzZXQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFpc09ubHlIZWFkZXJzV2l0aG91dEJpdHN0cmVhbSkge1xyXG4gICAgICAgICAgICB2YXIgdGlsZUJ5dGVzQ29waWVkID0gY3JlYXRlVGlsZUJpdHN0cmVhbShcclxuICAgICAgICAgICAgICAgIHJlc3VsdCxcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQsXHJcbiAgICAgICAgICAgICAgICB0aWxlU3RydWN0dXJlLFxyXG4gICAgICAgICAgICAgICAgdGlsZUlkT3JpZ2luYWwsXHJcbiAgICAgICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcyxcclxuICAgICAgICAgICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnMpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGN1cnJlbnRPZmZzZXQgKz0gdGlsZUJ5dGVzQ29waWVkO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRpbGVCeXRlc0NvcGllZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBlbmRUaWxlT2Zmc2V0ID0gY3VycmVudE9mZnNldDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaGVhZGVyQW5kRGF0YUxlbmd0aCA9XHJcbiAgICAgICAgICAgIGVuZFRpbGVPZmZzZXQgLSB0aWxlSGVhZGVyT2Zmc2V0cy5zdGFydE9mVGlsZUhlYWRlck9mZnNldDtcclxuXHJcbiAgICAgICAgaGVhZGVyTW9kaWZpZXIubW9kaWZ5SW50MzIoXHJcbiAgICAgICAgICAgIHJlc3VsdCxcclxuICAgICAgICAgICAgdGlsZUhlYWRlck9mZnNldHMuaGVhZGVyQW5kRGF0YUxlbmd0aFBsYWNlaG9sZGVyT2Zmc2V0LFxyXG4gICAgICAgICAgICBoZWFkZXJBbmREYXRhTGVuZ3RoKTtcclxuXHJcbiAgICAgICAgdmFyIGJ5dGVzQ29waWVkID0gZW5kVGlsZU9mZnNldCAtIHN0YXJ0VGlsZU9mZnNldDtcclxuICAgICAgICByZXR1cm4gYnl0ZXNDb3BpZWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVRpbGVIZWFkZXJBbmRHZXRPZmZzZXRzKFxyXG4gICAgICAgIHJlc3VsdCxcclxuICAgICAgICBjdXJyZW50T2Zmc2V0LFxyXG4gICAgICAgIHRpbGVIZWFkZXJEYXRhYmluLFxyXG4gICAgICAgIHRpbGVJZFRvV3JpdGUsXHJcbiAgICAgICAgbGV2ZWwpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3RhcnRPZlRpbGVIZWFkZXJPZmZzZXQgPSBjdXJyZW50T2Zmc2V0O1xyXG4gICAgXHJcbiAgICAgICAgdmFyIGJ5dGVzQ29waWVkID0gY29weUJ5dGVzKFxyXG4gICAgICAgICAgICByZXN1bHQsIGN1cnJlbnRPZmZzZXQsIGpHbG9iYWxzLmoya01hcmtlcnMuU3RhcnRPZlRpbGUpO1xyXG4gICAgICAgIGN1cnJlbnRPZmZzZXQgKz0gYnl0ZXNDb3BpZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQS40LjJcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3RhcnRPZlRpbGVTZWdtZW50TGVuZ3RoID0gWzAsIDEwXTsgLy8gTHNvdFxyXG4gICAgICAgIGJ5dGVzQ29waWVkID0gY29weUJ5dGVzKHJlc3VsdCwgY3VycmVudE9mZnNldCwgc3RhcnRPZlRpbGVTZWdtZW50TGVuZ3RoKTtcclxuICAgICAgICBjdXJyZW50T2Zmc2V0ICs9IGJ5dGVzQ29waWVkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlSW5kZXggPSBbdGlsZUlkVG9Xcml0ZSA+Pj4gOCwgdGlsZUlkVG9Xcml0ZSAmIDB4RkZdOyAvLyBJc290XHJcbiAgICAgICAgYnl0ZXNDb3BpZWQgPSBjb3B5Qnl0ZXMocmVzdWx0LCBjdXJyZW50T2Zmc2V0LCB0aWxlSW5kZXgpO1xyXG4gICAgICAgIGN1cnJlbnRPZmZzZXQgKz0gYnl0ZXNDb3BpZWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGhlYWRlckFuZERhdGFMZW5ndGhQbGFjZWhvbGRlck9mZnNldCA9IGN1cnJlbnRPZmZzZXQ7XHJcbiAgICAgICAgdmFyIGhlYWRlckFuZERhdGFMZW5ndGhQbGFjZWhvbGRlciA9IFswLCAwLCAwLCAwXTsgLy8gUHNvdFxyXG4gICAgICAgIGJ5dGVzQ29waWVkID0gY29weUJ5dGVzKHJlc3VsdCwgY3VycmVudE9mZnNldCwgaGVhZGVyQW5kRGF0YUxlbmd0aFBsYWNlaG9sZGVyKTtcclxuICAgICAgICBjdXJyZW50T2Zmc2V0ICs9IGJ5dGVzQ29waWVkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlUGFydEluZGV4ID0gWzBdOyAvLyBUUHNvdFxyXG4gICAgICAgIGJ5dGVzQ29waWVkID0gY29weUJ5dGVzKHJlc3VsdCwgY3VycmVudE9mZnNldCwgdGlsZVBhcnRJbmRleCk7XHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSBieXRlc0NvcGllZDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgbnVtYmVyT2ZUaWxlcGFydHMgPSBbMV07IC8vIFROc290XHJcbiAgICAgICAgYnl0ZXNDb3BpZWQgPSBjb3B5Qnl0ZXMocmVzdWx0LCBjdXJyZW50T2Zmc2V0LCBudW1iZXJPZlRpbGVwYXJ0cyk7XHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSBieXRlc0NvcGllZDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgYWZ0ZXJTdGFydE9mVGlsZVNlZ21lbnRPZmZzZXQgPSBjdXJyZW50T2Zmc2V0O1xyXG4gICAgICAgIGJ5dGVzQ29waWVkID0gdGlsZUhlYWRlckRhdGFiaW4uY29weUJ5dGVzKHJlc3VsdCwgY3VycmVudE9mZnNldCwge1xyXG4gICAgICAgICAgICBmb3JjZUNvcHlBbGxSYW5nZTogdHJ1ZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICBjdXJyZW50T2Zmc2V0ICs9IGJ5dGVzQ29waWVkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChieXRlc0NvcGllZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAvLyBOT1RFOiBDYW4gY3JlYXRlIGVtcHR5IHRpbGVcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpc0VuZGVkV2l0aFN0YXJ0T2ZEYXRhTWFya2VyID1cclxuICAgICAgICAgICAgcmVzdWx0W2N1cnJlbnRPZmZzZXQgLSAyXSA9PT0gakdsb2JhbHMuajJrTWFya2Vycy5TdGFydE9mRGF0YVswXSAmJlxyXG4gICAgICAgICAgICByZXN1bHRbY3VycmVudE9mZnNldCAtIDFdID09PSBqR2xvYmFscy5qMmtNYXJrZXJzLlN0YXJ0T2ZEYXRhWzFdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBpZiAoIWlzRW5kZWRXaXRoU3RhcnRPZkRhdGFNYXJrZXIpIHtcclxuICAgICAgICAgICAgYnl0ZXNDb3BpZWQgPSBjb3B5Qnl0ZXMoXHJcbiAgICAgICAgICAgICAgICByZXN1bHQsIGN1cnJlbnRPZmZzZXQsIGpHbG9iYWxzLmoya01hcmtlcnMuU3RhcnRPZkRhdGEpO1xyXG4gICAgICAgICAgICBjdXJyZW50T2Zmc2V0ICs9IGJ5dGVzQ29waWVkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXNBZGRlZCA9IGhlYWRlck1vZGlmaWVyLm1vZGlmeU1haW5PclRpbGVIZWFkZXIoXHJcbiAgICAgICAgICAgIHJlc3VsdCxcclxuICAgICAgICAgICAgdGlsZUhlYWRlckRhdGFiaW4sXHJcbiAgICAgICAgICAgIGFmdGVyU3RhcnRPZlRpbGVTZWdtZW50T2Zmc2V0LFxyXG4gICAgICAgICAgICBsZXZlbCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY3VycmVudE9mZnNldCArPSBieXRlc0FkZGVkO1xyXG5cclxuICAgICAgICB2YXIgb2Zmc2V0cyA9IHtcclxuICAgICAgICAgICAgc3RhcnRPZlRpbGVIZWFkZXJPZmZzZXQ6IHN0YXJ0T2ZUaWxlSGVhZGVyT2Zmc2V0LFxyXG4gICAgICAgICAgICBoZWFkZXJBbmREYXRhTGVuZ3RoUGxhY2Vob2xkZXJPZmZzZXQ6IGhlYWRlckFuZERhdGFMZW5ndGhQbGFjZWhvbGRlck9mZnNldCxcclxuICAgICAgICAgICAgZW5kVGlsZUhlYWRlck9mZnNldDogY3VycmVudE9mZnNldFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBvZmZzZXRzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVUaWxlQml0c3RyZWFtKFxyXG4gICAgICAgIHJlc3VsdCxcclxuICAgICAgICBjdXJyZW50T2Zmc2V0LFxyXG4gICAgICAgIHRpbGVTdHJ1Y3R1cmUsXHJcbiAgICAgICAgdGlsZUlkT3JpZ2luYWwsXHJcbiAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgbWluTnVtUXVhbGl0eUxheWVycykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBudW1RdWFsaXR5TGF5ZXJzSW5UaWxlID0gdGlsZVN0cnVjdHVyZS5nZXROdW1RdWFsaXR5TGF5ZXJzKCk7XHJcbiAgICAgICAgdmFyIHF1YWxpdHk7XHJcbiAgICAgICAgdmFyIGl0ZXJhdG9yID0gdGlsZVN0cnVjdHVyZS5nZXRQcmVjaW5jdEl0ZXJhdG9yKFxyXG4gICAgICAgICAgICB0aWxlSWRPcmlnaW5hbCxcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMsXHJcbiAgICAgICAgICAgIC8qaXNJdGVyYXRlUHJlY2luY3RzTm90SW5Db2Rlc3RyZWFtUGFydD0qL3RydWUpO1xyXG5cclxuICAgICAgICB2YXIgYWxsQnl0ZXNDb3BpZWQgPSAwO1xyXG4gICAgICAgIHZhciBoYXNNb3JlUGFja2V0cztcclxuICAgICAgICBcclxuICAgICAgICBpZiAoY29kZXN0cmVhbVBhcnRQYXJhbXMgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBxdWFsaXR5ID0gY29kZXN0cmVhbVBhcnRQYXJhbXMucXVhbGl0eTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1pbk51bVF1YWxpdHlMYXllcnMgPT09ICdtYXgnKSB7XHJcbiAgICAgICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnMgPSBudW1RdWFsaXR5TGF5ZXJzSW5UaWxlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIHZhciBlbXB0eVBhY2tldHNUb1B1c2ggPSBudW1RdWFsaXR5TGF5ZXJzSW5UaWxlO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGl0ZXJhdG9yLmlzSW5Db2Rlc3RyZWFtUGFydCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGluQ2xhc3NJZCA9XHJcbiAgICAgICAgICAgICAgICAgICAgdGlsZVN0cnVjdHVyZS5wcmVjaW5jdFBvc2l0aW9uVG9JbkNsYXNzSW5kZXgoaXRlcmF0b3IpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHByZWNpbmN0RGF0YWJpbiA9IGRhdGFiaW5zU2F2ZXIuZ2V0UHJlY2luY3REYXRhYmluKGluQ2xhc3NJZCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBxdWFsaXR5TGF5ZXJPZmZzZXQgPSBxdWFsaXR5TGF5ZXJzQ2FjaGUuZ2V0UXVhbGl0eUxheWVyT2Zmc2V0KFxyXG4gICAgICAgICAgICAgICAgICAgIHByZWNpbmN0RGF0YWJpbixcclxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxyXG4gICAgICAgICAgICAgICAgICAgIGl0ZXJhdG9yKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGJ5dGVzVG9Db3B5ID0gcXVhbGl0eUxheWVyT2Zmc2V0LmVuZE9mZnNldDtcclxuICAgICAgICAgICAgICAgIGVtcHR5UGFja2V0c1RvUHVzaCA9XHJcbiAgICAgICAgICAgICAgICAgICAgbnVtUXVhbGl0eUxheWVyc0luVGlsZSAtIHF1YWxpdHlMYXllck9mZnNldC5udW1RdWFsaXR5TGF5ZXJzO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAocXVhbGl0eUxheWVyT2Zmc2V0Lm51bVF1YWxpdHlMYXllcnMgPCBtaW5OdW1RdWFsaXR5TGF5ZXJzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBieXRlc0NvcGllZCA9IHByZWNpbmN0RGF0YWJpbi5jb3B5Qnl0ZXMocmVzdWx0LCBjdXJyZW50T2Zmc2V0LCB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yY2VDb3B5QWxsUmFuZ2U6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWF4TGVuZ3RoVG9Db3B5OiBieXRlc1RvQ29weVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoYnl0ZXNDb3BpZWQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBieXRlc0NvcGllZCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgZW1wdHlQYWNrZXRzVG9QdXNoID0gbnVtUXVhbGl0eUxheWVyc0luVGlsZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYWxsQnl0ZXNDb3BpZWQgKz0gYnl0ZXNDb3BpZWQ7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50T2Zmc2V0ICs9IGJ5dGVzQ29waWVkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVtcHR5UGFja2V0c1RvUHVzaDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbY3VycmVudE9mZnNldCsrXSA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYWxsQnl0ZXNDb3BpZWQgKz0gZW1wdHlQYWNrZXRzVG9QdXNoO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aGlsZSAoaXRlcmF0b3IudHJ5QWR2YW5jZSgpKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gYWxsQnl0ZXNDb3BpZWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZE1hbWF6YXZDb21tZW50KHJlc3VsdCwgY3VycmVudE9mZnNldCkge1xyXG4gICAgICAgIHZhciBzdGFydE9mZnNldCA9IGN1cnJlbnRPZmZzZXQ7XHJcbiAgICBcclxuICAgICAgICByZXN1bHRbY3VycmVudE9mZnNldCsrXSA9IDB4RkY7XHJcbiAgICAgICAgcmVzdWx0W2N1cnJlbnRPZmZzZXQrK10gPSAweDY0O1xyXG4gICAgICAgIHJlc3VsdFtjdXJyZW50T2Zmc2V0KytdID0gMHgwMDtcclxuICAgICAgICByZXN1bHRbY3VycmVudE9mZnNldCsrXSA9IDB4MDk7XHJcbiAgICAgICAgcmVzdWx0W2N1cnJlbnRPZmZzZXQrK10gPSA3NztcclxuICAgICAgICByZXN1bHRbY3VycmVudE9mZnNldCsrXSA9IDk3O1xyXG4gICAgICAgIHJlc3VsdFtjdXJyZW50T2Zmc2V0KytdID0gMTA5O1xyXG4gICAgICAgIHJlc3VsdFtjdXJyZW50T2Zmc2V0KytdID0gOTc7XHJcbiAgICAgICAgcmVzdWx0W2N1cnJlbnRPZmZzZXQrK10gPSAxMjI7XHJcbiAgICAgICAgcmVzdWx0W2N1cnJlbnRPZmZzZXQrK10gPSA5NztcclxuICAgICAgICByZXN1bHRbY3VycmVudE9mZnNldCsrXSA9IDExODtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXNBZGRlZCA9IGN1cnJlbnRPZmZzZXQgLSBzdGFydE9mZnNldDtcclxuICAgICAgICByZXR1cm4gYnl0ZXNBZGRlZDtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIGZ1bmN0aW9uIGNvcHlCeXRlcyhyZXN1bHQsIHJlc3VsdFN0YXJ0T2Zmc2V0LCBieXRlc1RvQ29weSkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXNUb0NvcHkubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgcmVzdWx0W2kgKyByZXN1bHRTdGFydE9mZnNldF0gPSBieXRlc1RvQ29weVtpXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGJ5dGVzVG9Db3B5Lmxlbmd0aDtcclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgakdsb2JhbHMgPSByZXF1aXJlKCdqMmstanBpcC1nbG9iYWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIEpwaXBIZWFkZXJNb2RpZmllcihcclxuICAgIGNvZGVzdHJlYW1TdHJ1Y3R1cmUsIG9mZnNldHNDYWxjdWxhdG9yLCBwcm9ncmVzc2lvbk9yZGVyKSB7XHJcblxyXG4gICAgdmFyIGVuY29kZWRQcm9ncmVzc2lvbk9yZGVyID0gZW5jb2RlUHJvZ3Jlc3Npb25PcmRlcihwcm9ncmVzc2lvbk9yZGVyKTtcclxuICAgICAgICBcclxuICAgIHRoaXMubW9kaWZ5TWFpbk9yVGlsZUhlYWRlciA9IGZ1bmN0aW9uIG1vZGlmeU1haW5PclRpbGVIZWFkZXIoXHJcbiAgICAgICAgcmVzdWx0LCBvcmlnaW5hbERhdGFiaW4sIGRhdGFiaW5PZmZzZXRJblJlc3VsdCwgbGV2ZWwpIHtcclxuICAgICAgICBcclxuICAgICAgICBtb2RpZnlQcm9ncmVzc2lvbk9yZGVyKHJlc3VsdCwgb3JpZ2luYWxEYXRhYmluLCBkYXRhYmluT2Zmc2V0SW5SZXN1bHQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChsZXZlbCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgYmVzdFJlc29sdXRpb25MZXZlbHNSYW5nZXMgPVxyXG4gICAgICAgICAgICBvZmZzZXRzQ2FsY3VsYXRvci5nZXRSYW5nZXNPZkJlc3RSZXNvbHV0aW9uTGV2ZWxzRGF0YShcclxuICAgICAgICAgICAgICAgIG9yaWdpbmFsRGF0YWJpbiwgbGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChiZXN0UmVzb2x1dGlvbkxldmVsc1Jhbmdlcy5udW1EZWNvbXBvc2l0aW9uTGV2ZWxzT2Zmc2V0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciBvZmZzZXQgPVxyXG4gICAgICAgICAgICAgICAgZGF0YWJpbk9mZnNldEluUmVzdWx0ICtcclxuICAgICAgICAgICAgICAgIGJlc3RSZXNvbHV0aW9uTGV2ZWxzUmFuZ2VzLm51bURlY29tcG9zaXRpb25MZXZlbHNPZmZzZXQ7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgcmVzdWx0W29mZnNldF0gLT0gbGV2ZWw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBieXRlc1JlbW92ZWQgPSByZW1vdmVSYW5nZXMoXHJcbiAgICAgICAgICAgIHJlc3VsdCwgYmVzdFJlc29sdXRpb25MZXZlbHNSYW5nZXMucmFuZ2VzLCBkYXRhYmluT2Zmc2V0SW5SZXN1bHQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBieXRlc0FkZGVkID0gLWJ5dGVzUmVtb3ZlZDtcclxuICAgICAgICByZXR1cm4gYnl0ZXNBZGRlZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMubW9kaWZ5SW1hZ2VTaXplID0gZnVuY3Rpb24gbW9kaWZ5SW1hZ2VTaXplKHJlc3VsdCwgY29kZXN0cmVhbVBhcnRQYXJhbXMpIHtcclxuICAgICAgICB2YXIgbmV3VGlsZVdpZHRoID0gY29kZXN0cmVhbVN0cnVjdHVyZS5nZXRUaWxlV2lkdGgoXHJcbiAgICAgICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLmxldmVsKTtcclxuICAgICAgICB2YXIgbmV3VGlsZUhlaWdodCA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0VGlsZUhlaWdodChcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMubGV2ZWwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBuZXdSZWZlcmVuY2VHcmlkU2l6ZSA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0U2l6ZU9mUGFydChcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzaXpNYXJrZXJPZmZzZXQgPSBvZmZzZXRzQ2FsY3VsYXRvci5nZXRJbWFnZUFuZFRpbGVTaXplT2Zmc2V0KCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHZhciByZWZlcmVuY2VHcmlkU2l6ZU9mZnNldCA9XHJcbiAgICAgICAgICAgIHNpek1hcmtlck9mZnNldCArIGpHbG9iYWxzLmoya09mZnNldHMuUkVGRVJFTkNFX0dSSURfU0laRV9PRkZTRVRfQUZURVJfU0laX01BUktFUjtcclxuXHJcbiAgICAgICAgdmFyIGltYWdlT2Zmc2V0Qnl0ZXNPZmZzZXQgPSByZWZlcmVuY2VHcmlkU2l6ZU9mZnNldCArIDg7XHJcbiAgICAgICAgdmFyIHRpbGVTaXplQnl0ZXNPZmZzZXQgPSByZWZlcmVuY2VHcmlkU2l6ZU9mZnNldCArIDE2O1xyXG4gICAgICAgIHZhciBmaXJzdFRpbGVPZmZzZXRCeXRlc09mZnNldCA9IHJlZmVyZW5jZUdyaWRTaXplT2Zmc2V0ICsgMjQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbW9kaWZ5SW50MzIocmVzdWx0LCByZWZlcmVuY2VHcmlkU2l6ZU9mZnNldCwgbmV3UmVmZXJlbmNlR3JpZFNpemUud2lkdGgpO1xyXG4gICAgICAgIG1vZGlmeUludDMyKHJlc3VsdCwgcmVmZXJlbmNlR3JpZFNpemVPZmZzZXQgKyA0LCBuZXdSZWZlcmVuY2VHcmlkU2l6ZS5oZWlnaHQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG1vZGlmeUludDMyKHJlc3VsdCwgdGlsZVNpemVCeXRlc09mZnNldCwgbmV3VGlsZVdpZHRoKTtcclxuICAgICAgICBtb2RpZnlJbnQzMihyZXN1bHQsIHRpbGVTaXplQnl0ZXNPZmZzZXQgKyA0LCBuZXdUaWxlSGVpZ2h0KTtcclxuICAgICAgICBcclxuICAgICAgICBtb2RpZnlJbnQzMihyZXN1bHQsIGltYWdlT2Zmc2V0Qnl0ZXNPZmZzZXQsIDApO1xyXG4gICAgICAgIG1vZGlmeUludDMyKHJlc3VsdCwgaW1hZ2VPZmZzZXRCeXRlc09mZnNldCArIDQsIDApO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgbW9kaWZ5SW50MzIocmVzdWx0LCBmaXJzdFRpbGVPZmZzZXRCeXRlc09mZnNldCwgMCk7XHJcbiAgICAgICAgbW9kaWZ5SW50MzIocmVzdWx0LCBmaXJzdFRpbGVPZmZzZXRCeXRlc09mZnNldCArIDQsIDApO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5tb2RpZnlJbnQzMiA9IG1vZGlmeUludDMyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBtb2RpZnlQcm9ncmVzc2lvbk9yZGVyKHJlc3VsdCwgb3JpZ2luYWxEYXRhYmluLCBkYXRhYmluT2Zmc2V0SW5SZXN1bHQpIHtcclxuICAgICAgICB2YXIgY29kaW5nU3R5bGVPZmZzZXQgPSBvZmZzZXRzQ2FsY3VsYXRvci5nZXRDb2RpbmdTdHlsZU9mZnNldChvcmlnaW5hbERhdGFiaW4pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjb2RpbmdTdHlsZU9mZnNldCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB2YXIgcHJvZ3Jlc3Npb25PcmRlck9mZnNldCA9XHJcbiAgICAgICAgICAgICAgICBkYXRhYmluT2Zmc2V0SW5SZXN1bHQgKyBjb2RpbmdTdHlsZU9mZnNldCArIDU7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXN1bHRbcHJvZ3Jlc3Npb25PcmRlck9mZnNldF0gPSBlbmNvZGVkUHJvZ3Jlc3Npb25PcmRlcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHJlbW92ZVJhbmdlcyhyZXN1bHQsIHJhbmdlc1RvUmVtb3ZlLCBhZGRPZmZzZXQpIHtcclxuICAgICAgICBpZiAocmFuZ2VzVG9SZW1vdmUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAwOyAvLyB6ZXJvIGJ5dGVzIHJlbW92ZWRcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByYW5nZXNUb1JlbW92ZS5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgb2Zmc2V0ID1cclxuICAgICAgICAgICAgICAgIGFkZE9mZnNldCArXHJcbiAgICAgICAgICAgICAgICByYW5nZXNUb1JlbW92ZVtpXS5tYXJrZXJTZWdtZW50TGVuZ3RoT2Zmc2V0O1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBvcmlnaW5hbE1hcmtlclNlZ21lbnRMZW5ndGggPVxyXG4gICAgICAgICAgICAgICAgKHJlc3VsdFtvZmZzZXRdIDw8IDgpICsgcmVzdWx0W29mZnNldCArIDFdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG5ld01hcmtlclNlZ21lbnRMZW5ndGggPVxyXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxNYXJrZXJTZWdtZW50TGVuZ3RoIC0gcmFuZ2VzVG9SZW1vdmVbaV0ubGVuZ3RoO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmVzdWx0W29mZnNldF0gPSBuZXdNYXJrZXJTZWdtZW50TGVuZ3RoID4+PiA4O1xyXG4gICAgICAgICAgICByZXN1bHRbb2Zmc2V0ICsgMV0gPSBuZXdNYXJrZXJTZWdtZW50TGVuZ3RoICYgMHhGRjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG9mZnNldFRhcmdldCA9IGFkZE9mZnNldCArIHJhbmdlc1RvUmVtb3ZlWzBdLnN0YXJ0O1xyXG4gICAgICAgIHZhciBvZmZzZXRTb3VyY2UgPSBvZmZzZXRUYXJnZXQ7XHJcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCByYW5nZXNUb1JlbW92ZS5sZW5ndGg7ICsraikge1xyXG4gICAgICAgICAgICBvZmZzZXRTb3VyY2UgKz0gcmFuZ2VzVG9SZW1vdmVbal0ubGVuZ3RoO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG5leHRSYW5nZU9mZnNldCA9XHJcbiAgICAgICAgICAgICAgICBqICsgMSA8IHJhbmdlc1RvUmVtb3ZlLmxlbmd0aCA/XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkT2Zmc2V0ICsgcmFuZ2VzVG9SZW1vdmVbaiArIDFdLnN0YXJ0IDpcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQubGVuZ3RoO1xyXG5cclxuICAgICAgICAgICAgZm9yICg7IG9mZnNldFNvdXJjZSA8IG5leHRSYW5nZU9mZnNldDsgKytvZmZzZXRTb3VyY2UpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFtvZmZzZXRUYXJnZXRdID0gcmVzdWx0W29mZnNldFNvdXJjZV07XHJcbiAgICAgICAgICAgICAgICArK29mZnNldFRhcmdldDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgYnl0ZXNSZW1vdmVkID0gb2Zmc2V0U291cmNlIC0gb2Zmc2V0VGFyZ2V0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBieXRlc1JlbW92ZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbW9kaWZ5SW50MzIoYnl0ZXMsIG9mZnNldCwgbmV3VmFsdWUpIHtcclxuICAgICAgICBieXRlc1tvZmZzZXQrK10gPSBuZXdWYWx1ZSA+Pj4gMjQ7XHJcbiAgICAgICAgYnl0ZXNbb2Zmc2V0KytdID0gKG5ld1ZhbHVlID4+PiAxNikgJiAweEZGO1xyXG4gICAgICAgIGJ5dGVzW29mZnNldCsrXSA9IChuZXdWYWx1ZSA+Pj4gOCkgJiAweEZGO1xyXG4gICAgICAgIGJ5dGVzW29mZnNldCsrXSA9IG5ld1ZhbHVlICYgMHhGRjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBlbmNvZGVQcm9ncmVzc2lvbk9yZGVyKHByb2dyZXNzaW9uT3JkZXIpIHtcclxuICAgICAgICAvLyBBLjYuMVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFRhYmxlIEEuMTZcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKHByb2dyZXNzaW9uT3JkZXIpIHtcclxuICAgICAgICAgICAgY2FzZSAnTFJDUCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICdSTENQJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgJ1JQQ0wnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDI7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICdQQ1JMJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiAzO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgJ0NQUkwnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDQ7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IGpHbG9iYWxzLmoya0V4Y2VwdGlvbnMuSWxsZWdhbERhdGFFeGNlcHRpb24oJ1Byb2dyZXNzaW9uIG9yZGVyIG9mICcgKyBwcm9ncmVzc2lvbk9yZGVyLCAnQS42LjEsIHRhYmxlIEEuMTYnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGpHbG9iYWxzID0gcmVxdWlyZSgnajJrLWpwaXAtZ2xvYmFscy5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBKcGlwUGFja2V0c0RhdGFDb2xsZWN0b3IoXHJcbiAgICBjb2Rlc3RyZWFtU3RydWN0dXJlLFxyXG4gICAgZGF0YWJpbnNTYXZlcixcclxuICAgIHF1YWxpdHlMYXllcnNDYWNoZSxcclxuICAgIGpwaXBGYWN0b3J5KSB7XHJcbiAgICBcclxuICAgIHRoaXMuZ2V0QWxsQ29kZWJsb2Nrc0RhdGEgPSBmdW5jdGlvbiBnZXRDb2RlYmxvY2tzRGF0YShcclxuICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcywgbWluTnVtUXVhbGl0eUxheWVycykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBhbHJlYWR5UmV0dXJuZWRDb2RlYmxvY2tzID0ganBpcEZhY3RvcnkuY3JlYXRlT2JqZWN0UG9vbEJ5RGF0YWJpbigpO1xyXG4gICAgICAgIHZhciBjb2RlYmxvY2tzRGF0YSA9IGdldE5ld0NvZGVibG9ja3NEYXRhQW5kVXBkYXRlUmV0dXJuZWRDb2RlYmxvY2tzKFxyXG4gICAgICAgICAgICBjb2Rlc3RyZWFtUGFydFBhcmFtcywgbWluTnVtUXVhbGl0eUxheWVycywgYWxyZWFkeVJldHVybmVkQ29kZWJsb2Nrcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY29kZWJsb2Nrc0RhdGE6IGNvZGVibG9ja3NEYXRhLFxyXG4gICAgICAgICAgICBhbHJlYWR5UmV0dXJuZWRDb2RlYmxvY2tzOiBhbHJlYWR5UmV0dXJuZWRDb2RlYmxvY2tzXHJcbiAgICAgICAgICAgIH07XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLmdldE5ld0NvZGVibG9ja3NEYXRhQW5kVXBkYXRlUmV0dXJuZWRDb2RlYmxvY2tzID1cclxuICAgICAgICBnZXROZXdDb2RlYmxvY2tzRGF0YUFuZFVwZGF0ZVJldHVybmVkQ29kZWJsb2NrcztcclxuICAgICAgICBcclxuICAgIGZ1bmN0aW9uIGdldE5ld0NvZGVibG9ja3NEYXRhQW5kVXBkYXRlUmV0dXJuZWRDb2RlYmxvY2tzKFxyXG4gICAgICAgIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLCBtaW5OdW1RdWFsaXR5TGF5ZXJzLCBhbHJlYWR5UmV0dXJuZWRDb2RlYmxvY2tzKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRpbGVJdGVyYXRvciA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0VGlsZXNJdGVyYXRvcihcclxuICAgICAgICAgICAgY29kZXN0cmVhbVBhcnRQYXJhbXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aWxlSW5kZXhJbkNvZGVzdHJlYW1QYXJ0ID0gMDtcclxuICAgICAgICB2YXIgZHVtbXlPZmZzZXQgPSAwO1xyXG4gICAgICAgIHZhciByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgIHBhY2tldERhdGFPZmZzZXRzOiBbXSxcclxuICAgICAgICAgICAgZGF0YToganBpcEZhY3RvcnkuY3JlYXRlQ29tcG9zaXRlQXJyYXkoZHVtbXlPZmZzZXQpLFxyXG4gICAgICAgICAgICBhbGxSZWxldmFudEJ5dGVzTG9hZGVkOiAwXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICB2YXIgdGlsZVN0cnVjdHVyZSA9IGNvZGVzdHJlYW1TdHJ1Y3R1cmUuZ2V0VGlsZVN0cnVjdHVyZShcclxuICAgICAgICAgICAgICAgIHRpbGVJdGVyYXRvci50aWxlSW5kZXgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHByZWNpbmN0SXRlcmF0b3IgPSB0aWxlU3RydWN0dXJlLmdldFByZWNpbmN0SXRlcmF0b3IoXHJcbiAgICAgICAgICAgICAgICB0aWxlSXRlcmF0b3IudGlsZUluZGV4LCBjb2Rlc3RyZWFtUGFydFBhcmFtcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgcXVhbGl0eSA9IHRpbGVTdHJ1Y3R1cmUuZ2V0TnVtUXVhbGl0eUxheWVycygpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGNvZGVzdHJlYW1QYXJ0UGFyYW1zLnF1YWxpdHkgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IE1hdGgubWluKFxyXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksIGNvZGVzdHJlYW1QYXJ0UGFyYW1zLnF1YWxpdHkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAobWluTnVtUXVhbGl0eUxheWVycyA9PT0gJ21heCcpIHtcclxuICAgICAgICAgICAgICAgIG1pbk51bVF1YWxpdHlMYXllcnMgPSBxdWFsaXR5O1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1pbk51bVF1YWxpdHlMYXllcnMgPiBxdWFsaXR5KSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAnbWluTnVtUXVhbGl0eUxheWVycyBpcyBsYXJnZXIgdGhhbiBxdWFsaXR5Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgICAgIGlmICghcHJlY2luY3RJdGVyYXRvci5pc0luQ29kZXN0cmVhbVBhcnQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgakdsb2JhbHMuanBpcEV4Y2VwdGlvbnMuSW50ZXJuYWxFcnJvckV4Y2VwdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgcHJlY2luY3Qgbm90IGluIGNvZGVzdHJlYW0gcGFydCcpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgaW5DbGFzc0luZGV4ID0gdGlsZVN0cnVjdHVyZS5wcmVjaW5jdFBvc2l0aW9uVG9JbkNsYXNzSW5kZXgoXHJcbiAgICAgICAgICAgICAgICAgICAgcHJlY2luY3RJdGVyYXRvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgcHJlY2luY3REYXRhYmluID0gZGF0YWJpbnNTYXZlci5nZXRQcmVjaW5jdERhdGFiaW4oXHJcbiAgICAgICAgICAgICAgICAgICAgaW5DbGFzc0luZGV4KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHJldHVybmVkSW5QcmVjaW5jdCA9XHJcbiAgICAgICAgICAgICAgICAgICAgYWxyZWFkeVJldHVybmVkQ29kZWJsb2Nrcy5nZXRPYmplY3QocHJlY2luY3REYXRhYmluKTtcclxuICAgICAgICAgICAgICAgIGlmIChyZXR1cm5lZEluUHJlY2luY3QubGF5ZXJQZXJDb2RlYmxvY2sgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybmVkSW5QcmVjaW5jdC5sYXllclBlckNvZGVibG9jayA9IFtdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBsYXllclJlYWNoZWQgPSBwdXNoUGFja2V0cyhcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgICAgICAgICAgICAgdGlsZUluZGV4SW5Db2Rlc3RyZWFtUGFydCxcclxuICAgICAgICAgICAgICAgICAgICBwcmVjaW5jdEl0ZXJhdG9yLFxyXG4gICAgICAgICAgICAgICAgICAgIHByZWNpbmN0RGF0YWJpbixcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm5lZEluUHJlY2luY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChsYXllclJlYWNoZWQgPCBtaW5OdW1RdWFsaXR5TGF5ZXJzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gTk9URTogYWxyZWFkeVJldHVybmVkQ29kZWJsb2NrcyBpcyB3cm9uZyBpbiB0aGlzIHN0YWdlLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgaXQgd2FzIHVwZGF0ZWQgd2l0aCBhIGRhdGEgd2hpY2ggd2lsbCBub3QgYmVcclxuICAgICAgICAgICAgICAgICAgICAvLyByZXR1cm5lZC4gSSBkb24ndCBjYXJlIGFib3V0IGl0IG5vdyBiZWNhdXNlIHJldHVybmluZ1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIG51bGwgaGVyZSBtZWFucyBzb21ldGhpbmcgYmFkIGhhcHBlbmVkIChhbiBleGNlcHRpb24gaXNcclxuICAgICAgICAgICAgICAgICAgICAvLyB0aHJvd24gaW4gUmVxdWVzdENvbnRleHQgd2hlbiB0aGlzIGhhcHBlbnMpLlxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHNvbWUgZGF5IHRoZSBjb25zaXN0ZW5jeSBvZiBhbHJlYWR5UmV0dXJuZWRDb2RlYmxvY2tzXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgaW1wb3J0YW50IHRoZW4gYSBuZXcgb2JqZWN0IHNob3VsZCBiZSByZXR1cm5lZCBvbiBlYWNoXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FsbCB0byB0aGlzIGZ1bmN0aW9uLCBvciBhIHRyYW5zYWN0aW9uYWwgc3R5bGUgc2hvdWxkIGJlXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlZCBoZXJlIHRvIGFib3J0IGFsbCBub24tcmV0dXJuZWQgZGF0YS5cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSB3aGlsZSAocHJlY2luY3RJdGVyYXRvci50cnlBZHZhbmNlKCkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgKyt0aWxlSW5kZXhJbkNvZGVzdHJlYW1QYXJ0O1xyXG4gICAgICAgIH0gd2hpbGUgKHRpbGVJdGVyYXRvci50cnlBZHZhbmNlKCkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBkYXRhQXNVaW50OCA9IG5ldyBVaW50OEFycmF5KHJlc3VsdC5kYXRhLmdldExlbmd0aCgpKTtcclxuICAgICAgICByZXN1bHQuZGF0YS5jb3B5VG9UeXBlZEFycmF5KGRhdGFBc1VpbnQ4LCAwLCAwLCByZXN1bHQuZGF0YS5nZXRMZW5ndGgoKSk7XHJcbiAgICAgICAgcmVzdWx0LmRhdGEgPSBkYXRhQXNVaW50ODtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHB1c2hQYWNrZXRzKFxyXG4gICAgICAgIHJlc3VsdCxcclxuICAgICAgICB0aWxlSW5kZXhJbkNvZGVzdHJlYW1QYXJ0LFxyXG4gICAgICAgIHByZWNpbmN0SXRlcmF0b3IsXHJcbiAgICAgICAgcHJlY2luY3REYXRhYmluLFxyXG4gICAgICAgIHJldHVybmVkQ29kZWJsb2Nrc0luUHJlY2luY3QsXHJcbiAgICAgICAgcXVhbGl0eSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsYXllcjtcclxuICAgICAgICB2YXIgb2Zmc2V0SW5QcmVjaW5jdERhdGFiaW47XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsYXllciA9IDA7IGxheWVyIDwgcXVhbGl0eTsgKytsYXllcikge1xyXG4gICAgICAgICAgICB2YXIgY29kZWJsb2NrT2Zmc2V0c0luRGF0YWJpbiA9XHJcbiAgICAgICAgICAgICAgICBxdWFsaXR5TGF5ZXJzQ2FjaGUuZ2V0UGFja2V0T2Zmc2V0c0J5Q29kZWJsb2NrSW5kZXgoXHJcbiAgICAgICAgICAgICAgICAgICAgcHJlY2luY3REYXRhYmluLCBsYXllciwgcHJlY2luY3RJdGVyYXRvcik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoY29kZWJsb2NrT2Zmc2V0c0luRGF0YWJpbiA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIG9mZnNldEluUHJlY2luY3REYXRhYmluID1cclxuICAgICAgICAgICAgICAgIGNvZGVibG9ja09mZnNldHNJbkRhdGFiaW4uaGVhZGVyU3RhcnRPZmZzZXQgK1xyXG4gICAgICAgICAgICAgICAgY29kZWJsb2NrT2Zmc2V0c0luRGF0YWJpbi5oZWFkZXJMZW5ndGg7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbnVtQ29kZWJsb2NrcyA9XHJcbiAgICAgICAgICAgICAgICBjb2RlYmxvY2tPZmZzZXRzSW5EYXRhYmluLmNvZGVibG9ja0JvZHlMZW5ndGhCeUluZGV4Lmxlbmd0aDtcclxuICAgICAgICAgICAgdmFyIGNvZGVibG9ja09mZnNldHNJblJlc3VsdCA9IG5ldyBBcnJheShudW1Db2RlYmxvY2tzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBpc0luY29tcGxldGVQYWNrZXQgPSBmYWxzZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtQ29kZWJsb2NrczsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmV0dXJuZWQgPSByZXR1cm5lZENvZGVibG9ja3NJblByZWNpbmN0LmxheWVyUGVyQ29kZWJsb2NrW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJldHVybmVkID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm5lZCA9IHsgbGF5ZXI6IC0xIH07XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuZWRDb2RlYmxvY2tzSW5QcmVjaW5jdC5sYXllclBlckNvZGVibG9ja1tpXSA9IHJldHVybmVkO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZXR1cm5lZC5sYXllciA+PSBsYXllcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgY29kZWJsb2NrID1cclxuICAgICAgICAgICAgICAgICAgICBjb2RlYmxvY2tPZmZzZXRzSW5EYXRhYmluLmNvZGVibG9ja0JvZHlMZW5ndGhCeUluZGV4W2ldO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgb2Zmc2V0SW5SZXN1bHRBcnJheSA9IHJlc3VsdC5kYXRhLmdldExlbmd0aCgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgYnl0ZXNDb3BpZWQgPSBwcmVjaW5jdERhdGFiaW4uY29weVRvQ29tcG9zaXRlQXJyYXkoXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LmRhdGEsXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhYmluU3RhcnRPZmZzZXQ6IG9mZnNldEluUHJlY2luY3REYXRhYmluLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhMZW5ndGhUb0NvcHk6IGNvZGVibG9jay5jb2RlYmxvY2tCb2R5TGVuZ3RoQnl0ZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcmNlQ29weUFsbFJhbmdlOiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChieXRlc0NvcGllZCAhPT0gY29kZWJsb2NrLmNvZGVibG9ja0JvZHlMZW5ndGhCeXRlcykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvZGVibG9ja09mZnNldHNJblJlc3VsdC5sZW5ndGggPSBpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlzSW5jb21wbGV0ZVBhY2tldCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybmVkLmxheWVyID0gbGF5ZXI7XHJcbiAgICAgICAgICAgICAgICBjb2RlYmxvY2tPZmZzZXRzSW5SZXN1bHRbaV0gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQ6IG9mZnNldEluUmVzdWx0QXJyYXksXHJcbiAgICAgICAgICAgICAgICAgICAgZW5kOiBvZmZzZXRJblJlc3VsdEFycmF5ICsgY29kZWJsb2NrLmNvZGVibG9ja0JvZHlMZW5ndGhCeXRlcyxcclxuICAgICAgICAgICAgICAgICAgICBjb2RpbmdwYXNzZXM6IGNvZGVibG9jay5jb2RpbmdQYXNzZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgemVyb0JpdFBsYW5lczogY29kZWJsb2NrLnplcm9CaXRQbGFuZXNcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBvZmZzZXRJblByZWNpbmN0RGF0YWJpbiArPSBjb2RlYmxvY2suY29kZWJsb2NrQm9keUxlbmd0aEJ5dGVzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgcGFja2V0ID0ge1xyXG4gICAgICAgICAgICAgICAgdGlsZUluZGV4OiB0aWxlSW5kZXhJbkNvZGVzdHJlYW1QYXJ0LFxyXG4gICAgICAgICAgICAgICAgcjogcHJlY2luY3RJdGVyYXRvci5yZXNvbHV0aW9uTGV2ZWwsXHJcbiAgICAgICAgICAgICAgICBwOiBwcmVjaW5jdEl0ZXJhdG9yLnByZWNpbmN0SW5kZXhJbkNvbXBvbmVudFJlc29sdXRpb24sXHJcbiAgICAgICAgICAgICAgICBjOiBwcmVjaW5jdEl0ZXJhdG9yLmNvbXBvbmVudCxcclxuICAgICAgICAgICAgICAgIGw6IGxheWVyLFxyXG4gICAgICAgICAgICAgICAgY29kZWJsb2NrT2Zmc2V0czogY29kZWJsb2NrT2Zmc2V0c0luUmVzdWx0XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgcmVzdWx0LnBhY2tldERhdGFPZmZzZXRzLnB1c2gocGFja2V0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChpc0luY29tcGxldGVQYWNrZXQpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJlc3VsdC5hbGxSZWxldmFudEJ5dGVzTG9hZGVkICs9IG9mZnNldEluUHJlY2luY3REYXRhYmluO1xyXG4gICAgICAgIHJldHVybiBsYXllcjtcclxuICAgIH0gICAgXHJcbn07Il19
