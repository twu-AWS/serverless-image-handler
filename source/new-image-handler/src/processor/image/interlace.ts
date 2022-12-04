import { IImageContext } from '.';
import { IActionOpts, ReadOnly, InvalidArgument } from '..';
import { BaseImageAction } from './_base';
export interface InterlaceOpts extends IActionOpts {
  interlace: boolean;
}

export class InterlaceAction extends BaseImageAction {
  public readonly name: string = 'interlace';

  public validate(params: string[]): ReadOnly<InterlaceOpts> {
    let opt: InterlaceOpts = { interlace: false };

    if (params.length !== 2) {
      throw new InvalidArgument('Interlace param error, e.g: interlace,1');
    }
    if (params[1] === '1') {
      opt.interlace = true;
    } else if (params[1] === '0') {
      opt.interlace = false;
    } else {
      throw new InvalidArgument('Interlace must be 0 or 1');
    }
    return opt;
  }

  public beforeProcess(ctx: IImageContext, _2: string[], index: number): void {
    if ('gif' === ctx.metadata.format) {
      ctx.mask.disable(index);
    }
  }

  public async process(ctx: IImageContext, params: string[]): Promise<void> {
    const opt = this.validate(params);
    const metadata = ctx.metadata;
    if (('jpg' === metadata.format || 'jpeg' === metadata.format) && opt.interlace) {
      ctx.image.jpeg({ progressive: true });
    }
  }
}