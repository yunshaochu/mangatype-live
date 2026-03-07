import assert from 'node:assert/strict';
import { fetchRawDetectedRegions } from './geminiService';

const originalFetch = globalThis.fetch;

const main = async () => {
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));

    assert.equal(body.return_mask, 'true', 'detection helper should request refined mask data');
    assert.match(body.image, /^data:image\/jpeg;base64,/, 'detection helper should send base64 image payload');

    return new Response(JSON.stringify({
      success: true,
      image_size: { width: 200, height: 100 },
      text_blocks: [
        {
          xyxy: [20, 10, 120, 50],
          lines: [
            [[20, 10], [120, 10], [120, 24], [20, 24]],
            [[24, 28], [112, 28], [112, 50], [24, 50]],
          ],
          mask_refined_region_base64: 'mask-block-1',
        },
      ],
      mask_refined_base64: 'mask-page',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await fetchRawDetectedRegions('data:image/png;base64,Zm9v', 'http://localhost:5000');

  assert.equal(result.rects.length, 1, 'should map one detected text block');
  assert.equal(result.maskBase64, 'mask-page', 'should pass through page refined mask');
  assert.deepEqual(result.rects[0], {
    x: 35,
    y: 30,
    width: 50,
    height: 40,
    maskContourBase64: 'mask-block-1',
    linePolygons: [
      [
        { x: 10, y: 10 },
        { x: 60, y: 10 },
        { x: 60, y: 24 },
        { x: 10, y: 24 },
      ],
      [
        { x: 12, y: 28 },
        { x: 56, y: 28 },
        { x: 56, y: 50 },
        { x: 12, y: 50 },
      ],
    ],
  }, 'should normalize text block rect and line polygons into percentages');

  console.log('geminiServiceDetectionApi tests passed');
};

main()
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
