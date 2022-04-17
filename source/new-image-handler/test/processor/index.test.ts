import * as sharp from 'sharp';
import { Features } from '../../src/processor';
import { ImageProcessor } from '../../src/processor/image';
import { ResizeAction } from '../../src/processor/image/resize';
import { StyleProcessor } from '../../src/processor/style';
import { MemKVStore, SharpBufferStore } from '../../src/store';
import { fixtureStore, mkctx } from './image/utils';


test('image processor singleton', () => {
  const p1 = ImageProcessor.getInstance();
  const p2 = ImageProcessor.getInstance();

  expect(p1).toBe(p2);
});

test('processor register', () => {
  class MyResizeAction extends ResizeAction {
    public readonly name: string = 'my-resize';
  }
  const p = ImageProcessor.getInstance();
  const resizeAction = new MyResizeAction();

  p.register(resizeAction);

  expect(resizeAction.name).toBe('my-resize');
  expect(p.action('my-resize') === resizeAction).toBeTruthy();
});

test('image processor test', async () => {
  const bs = new SharpBufferStore(sharp({
    create: {
      width: 50,
      height: 50,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  }).png());
  const ctx = await mkctx('', 'image/resize,w_100,h_100,m_fixed,limit_0/'.split('/'), bs);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.width).toBe(100);
  expect(info.height).toBe(100);
});

test('image/crop,w_100,h_100/rounded-corners,r_10/format,png', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', 'image/crop,w_100,h_100/rounded-corners,r_10/format,png'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.width).toBe(100);
  expect(info.height).toBe(100);
  expect(info.channels).toBe(4);
});

test('image/resize,w_100/rounded-corners,r_10/format,png', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', 'image/resize,w_100/rounded-corners,r_10/format,png'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.channels).toBe(4);
});

test('image/resize,w_50/crop,w_100,h_100/rounded-corners,r_100/format,png', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', 'image/resize,w_50/crop,w_100,h_100/rounded-corners,r_100/format,png'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.width).toBe(50);
  expect(info.height).toBe(33);
  expect(info.channels).toBe(4);
});

test('image/resize,w_20/indexcrop,x_50,i_0/', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', 'image/resize,w_20/indexcrop,x_50,i_0/'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.width).toBe(20);
});

test('example.gif?x-oss-process=image/format,jpg', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.gif', 'image/format,jpg'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.width).toBe(500);
  expect(info.height).toBe(300);
  expect(info.channels).toBe(3);
});

test('example.jpg?x-oss-process=image/resize,w_200/rotate,90', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', 'image/resize,w_200/rotate,90'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.width).toBe(134);
  expect(info.height).toBe(200);
  expect(info.channels).toBe(3);
});

test('example.gif?x-oss-process=image/format,png', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.gif', 'image/format,png'.split('/'), fixtureStore);
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(ctx.features[Features.ReadAllAnimatedFrames]).toBe(false);
  expect(info.width).toBe(500);
  expect(info.height).toBe(300);
  expect(info.format).toBe('png');
});

test('autowebp: example.jpg', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', [], fixtureStore);
  ctx.features[Features.AutoWebp] = true;
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.format).toBe('webp');
});

test('autowebp: example.jpg?x-oss-process=image/format,png', async () => {
  const ctx = await ImageProcessor.getInstance().newContext('example.jpg', 'image/format,png'.split('/'), fixtureStore);
  ctx.features[Features.AutoWebp] = true;
  await ImageProcessor.getInstance().process(ctx);
  const { info } = await ctx.image.toBuffer({ resolveWithObject: true });

  expect(info.format).toBe('png');
});

test('style processor test', async () => {
  const styleStore = new MemKVStore({
    style1: { id: 'style1', style: 'image/resize,w_100,h_100,m_fixed,limit_0/' },
  });
  const p = StyleProcessor.getInstance(styleStore);
  const ctx = await p.newContext('example.jpg', 'style/style1'.split('/'), fixtureStore);
  const { data } = await p.process(ctx);
  const metadata = await sharp(data).metadata();

  expect(metadata.width).toBe(100);
  expect(metadata.height).toBe(100);
});

test('style processor test invalid style name', async () => {
  const bs = new SharpBufferStore(sharp({
    create: {
      width: 50,
      height: 50,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  }).png());
  const ctx = await mkctx('', 'style/ #$ '.split('/'), bs);
  const styleStore = new MemKVStore({
    style1: { id: 'style1', style: 'image/resize,w_100,h_100,m_fixed,limit_0/' },
  });
  void expect(StyleProcessor.getInstance(styleStore).process(ctx))
    .rejects.toThrowError(/Invalid style name/);
});

test('style processor not found', async () => {
  const bs = new SharpBufferStore(sharp({
    create: {
      width: 50,
      height: 50,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  }).png());
  const ctx = await mkctx('', 'style/notfound'.split('/'), bs);
  const styleStore = new MemKVStore({
    style1: { id: 'style1', style: 'image/resize,w_100,h_100,m_fixed,limit_0/' },
  });
  void expect(StyleProcessor.getInstance(styleStore).process(ctx))
    .rejects.toThrowError(/Style not found/);
});