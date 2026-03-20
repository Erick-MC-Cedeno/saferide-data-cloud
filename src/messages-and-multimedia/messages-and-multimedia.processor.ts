import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocalStorageProvider } from 'src/storage/local.storage.provider';
import { MultimediaRepository } from 'src/repositories/multimedia.repository';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { finished } from 'stream/promises';
import { execSync } from 'child_process';


// Try to set up ffmpeg/ffprobe paths without blocking startup.
(async () => {
  const resolvedFfmpegPath = ffmpegPath || undefined;
  if (resolvedFfmpegPath) {
    try {
      await (fsPromises as any).access(resolvedFfmpegPath);
      ffmpeg.setFfmpegPath(resolvedFfmpegPath);
    } catch {
      // ignore and try system PATH below
    }
  } else {
    try {
      const { exec } = require('child_process');
      const whichCmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
      const out = await new Promise<string | undefined>((resolve) => {
        exec(whichCmd, (err: any, stdout: string) => resolve((stdout || '').trim()));
      });
      if (out) ffmpeg.setFfmpegPath(out);
    } catch {
      // ignore
    }
  }
})();

(async () => {
  const probePath = (ffprobePath && (ffprobePath as any).path) || ffprobePath || undefined;
  if (probePath) {
    try {
      await (fsPromises as any).access(probePath);
      ffmpeg.setFfprobePath(probePath);
    } catch {
      // fallback below
    }
  } else {
    try {
      const { exec } = require('child_process');
      const whichProbe = process.platform === 'win32' ? 'where ffprobe' : 'which ffprobe';
      const outp = await new Promise<string | undefined>((resolve) => {
        exec(whichProbe, (err: any, stdout: string) => resolve((stdout || '').trim()));
      });
      if (outp) ffmpeg.setFfprobePath(outp);
    } catch {
      // ignore
    }
  }
})();

@Processor('multimedia')
@Injectable()
export class MultimediaProcessor {
  constructor(
    private readonly storage: LocalStorageProvider,
    private readonly multimediaRepository: MultimediaRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get multimediaModel() {
    return this.multimediaRepository;
  }

  @Process('process')
  async handle(job: Job) {
    const { stagingKey, multimediaId } = job.data;
    
    // download object from storage provider (staging)
    // Prefer stream download when available to avoid buffering large files entirely in RAM
    const tmpDir = os.tmpdir();
    const baseName = `${crypto.randomUUID()}-${stagingKey.split('/').pop()}`;
    const tempIn = path.join(tmpDir, baseName);
    const hasDownloadStream = typeof (this.storage as any).downloadStream === 'function';
    if (hasDownloadStream) {
      // stream to temp file
      await fsPromises.mkdir(path.dirname(tempIn), { recursive: true }).catch(() => {});
      const read = (this.storage as any).downloadStream(stagingKey) as NodeJS.ReadableStream;
      const write = fs.createWriteStream(tempIn);
      read.pipe(write);
      await finished(write);
    } else {
      const buffer = await this.storage.download(stagingKey);
      await fsPromises.writeFile(tempIn, buffer);
    }

    // determine mime
    const mime = job.data.mimeType || 'application/octet-stream';
    

    try {
      // simple branching by mime
      let finalKey = `final/${crypto.randomUUID()}-${stagingKey.split('/').pop()}`;
      let thumbnailUrl: string | undefined;
      let metadata: any = {};

      if (mime.startsWith('image/')) {
        // process image from temp file to avoid buffering in memory
        const optName = `opt-${baseName}`;
        const optPath = path.join(tmpDir, optName);
        const thumbName = `thumb-${baseName}.jpg`;
        const thumbPath = path.join(tmpDir, thumbName);

        await sharp(tempIn).toFile(optPath);
        await sharp(tempIn).resize({ width: 200 }).toFile(thumbPath);
        const meta = await sharp(tempIn).metadata();
        metadata = { width: meta.width, height: meta.height, format: meta.format };

        // upload optimized and thumbnail using stream upload if available
        if (typeof (this.storage as any).uploadStream === 'function') {
          const optStream = fs.createReadStream(optPath);
          const uploadRes = await (this.storage as any).uploadStream(optStream, finalKey, mime);
          const thumbStream = fs.createReadStream(thumbPath);
          const thumbRes = await (this.storage as any).uploadStream(thumbStream, `thumbs/${crypto.randomUUID()}-${stagingKey.split('/').pop()}`, mime);
          thumbnailUrl = thumbRes.url;
          finalKey = uploadRes.key;
        } else {
          const optBuf = await fsPromises.readFile(optPath);
          const uploadRes = await this.storage.upload(optBuf, finalKey, mime);
          const thumbBuf = await fsPromises.readFile(thumbPath);
          const thumbRes = await this.storage.upload(thumbBuf, `thumbs/${crypto.randomUUID()}-${stagingKey.split('/').pop()}`, mime);
          thumbnailUrl = thumbRes.url;
          finalKey = uploadRes.key;
        }
        // cleanup temp files
        try { await fsPromises.unlink(optPath); } catch (_) {}
        try { await fsPromises.unlink(thumbPath); } catch (_) {}
      } else if (mime.startsWith('video/')) {
        // process video files via temp files so ffmpeg works without buffering entire file
        const tempOut = path.join(tmpDir, `out-${baseName}.mp4`);
        
        // probe for duration/metadata (ffprobe)
        let durationSec: number | undefined = undefined;
          try {
            const probe: any = await new Promise<any>((resolve, reject) => {
              ffmpeg.ffprobe(tempIn, (err: any, data: any) => (err ? reject(err) : resolve(data)));
            });
            durationSec = probe?.format?.duration ? Number(probe.format.duration) : undefined;
            // extract video stream resolution if available
            let width: number | undefined = undefined;
            let height: number | undefined = undefined;
            try {
              const vstream = (probe?.streams || []).find((s: any) => s.width && s.height);
              if (vstream) {
                width = Number(vstream.width) || undefined;
                height = Number(vstream.height) || undefined;
              }
            } catch (_) {}
            // attach to metadata later
            (metadata as any).duration = durationSec;
            // enforce maximum allowed duration (5 minutes)
            try {
              const MAX_VIDEO_SECONDS = 5 * 60; // 5 minutes
              if (durationSec && durationSec > MAX_VIDEO_SECONDS) {
                // mark multimedia as failed and clean up uploaded staging file
                try {
                  await this.multimediaModel.findByIdAndUpdate(multimediaId, { status: 'failed', lastError: 'duration exceeds 5 minutes' }).exec();
                } catch (_) {}
                try { await fsPromises.unlink(tempIn); } catch (_) {}
                throw new Error('Video duration exceeds maximum allowed length (5 minutes)');
              }
            } catch (_) {}
            if (width) (metadata as any).width = width;
            if (height) (metadata as any).height = height;
          } catch (probeErr) {
            durationSec = undefined;
          }
        await new Promise<void>((resolve, reject) => {
          const proc = ffmpeg(tempIn)
            .videoCodec('libx264')
            .outputOptions(['-preset', 'fast'])
            .save(tempOut)
            .on('start', (_cmd: string) => {
            })
            .on('progress', (progress: any) => {
              try {
                let percent: number | undefined = undefined;
                const tm = progress.timemark;
                if (durationSec && tm && tm !== 'N/A') {
                  const parts = tm.split(':').map((v: string) => Number(v) || 0);
                  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
                  percent = durationSec ? Math.min(100, (seconds / durationSec) * 100) : undefined;
                }
              } catch (_) {}
            })
            .on('stderr', (_stderrLine: string) => {
            })
            .on('end', () => {
              resolve();
            })
            .on('error', (_e: any) => {
              reject(_e);
            });
        });

        let uploadRes: any;
        try {
          if (typeof (this.storage as any).uploadStream === 'function') {
            const outStream = fs.createReadStream(tempOut);
            uploadRes = await (this.storage as any).uploadStream(outStream, finalKey, 'video/mp4');
          } else {
            const outBuf = await fsPromises.readFile(tempOut);
            uploadRes = await this.storage.upload(outBuf, finalKey, 'video/mp4');
          }
          
        } catch (upErr) {
          console.error('[MultimediaProcessor] upload failed for video', upErr);
          throw upErr;
        }

        // thumbnail
        const thumbName = `thumb-${baseName}.jpg`;
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempOut)
            .screenshots({ count: 1, folder: tmpDir, filename: thumbName })
            .on('end', () => {
              resolve();
            })
            .on('error', (_e: any) => {
              reject(_e);
            });
        });
        try {
          if (typeof (this.storage as any).uploadStream === 'function') {
              const tstream = fs.createReadStream(path.join(tmpDir, thumbName));
              const thumbRes = await (this.storage as any).uploadStream(tstream, `thumbs/${crypto.randomUUID()}-${stagingKey.split('/').pop()}`, 'image/jpeg');
            thumbnailUrl = thumbRes.url;
          } else {
            const thumbBuf = await fsPromises.readFile(path.join(tmpDir, thumbName));
            const thumbRes = await this.storage.upload(thumbBuf, `thumbs/${crypto.randomUUID()}-${stagingKey.split('/').pop()}`, 'image/jpeg');
            thumbnailUrl = thumbRes.url;
          }
        } catch (thumbUploadErr) {
          
        }
        // metadata may have been partially populated from ffprobe above
        metadata = { ...(metadata || {}), duration: (metadata as any).duration || durationSec, width: (metadata as any).width, height: (metadata as any).height };
        try { await fsPromises.unlink(tempIn); await fsPromises.unlink(tempOut); await fsPromises.unlink(path.join(tmpDir, thumbName)); } catch (_) {}
        finalKey = uploadRes.key;
      } else if (mime.startsWith('audio/')) {
        // probe audio file and upload without buffering whole stream when possible
        let probe: any = undefined;
        try {
          probe = await new Promise<any>((resolve, reject) => {
              ffmpeg.ffprobe(tempIn, (err: any, data: any) => (err ? reject(err) : resolve(data)));
            });
        } catch (_) {
          probe = undefined;
        }
        const duration = probe?.format?.duration ? Number(probe.format.duration) : undefined;
        const bitrate = probe?.format?.bit_rate ? Number(probe.format.bit_rate) : undefined;
        let uploadRes;
        if (typeof (this.storage as any).uploadStream === 'function') {
          uploadRes = await (this.storage as any).uploadStream(fs.createReadStream(tempIn), finalKey, mime);
        } else {
          const buf = await fsPromises.readFile(tempIn);
          uploadRes = await this.storage.upload(buf, finalKey, mime);
        }
        metadata = { duration, bitrate };
        try { await fsPromises.unlink(tempIn); } catch (_) {}
        finalKey = uploadRes.key;
      }

      // Compute public URL and encoded variant for safe storage/clients
      const publicUrl = this.storage.getPublicUrl(finalKey);
      const encodedUrl = publicUrl.split('/').map(s => encodeURIComponent(s)).join('/');
      const encodedThumbnail = thumbnailUrl ? thumbnailUrl.split('/').map(s => encodeURIComponent(s)).join('/') : undefined;

      // update multimedia doc with encoded URLs so DB always contains safe paths
      await this.multimediaModel.findByIdAndUpdate(multimediaId, {
        url: encodedUrl,
        thumbnailUrl: encodedThumbnail,
        status: 'ready',
        ...metadata,
      }).exec();

      // emit event so realtime clients can update (thumbnail, url, metadata)
      try {
        // log for debugging so dev can confirm the final public URL
        try { console.log(`[MultimediaProcessor] multimedia.ready url=${publicUrl} encoded=${encodedUrl} messageId=${job.data.messageId}`); } catch (_) {}
        void this.eventEmitter.emit('multimedia.ready', {
          multimediaId: multimediaId,
          messageId: job.data.messageId,
          url: encodedUrl,
          thumbnailUrl: encodedThumbnail,
          metadata,
        });
      } catch (_) {}

      // delete staging
      try { await this.storage.delete(stagingKey); } catch (_) {}

    } catch (err) {
      const errorPayload: any = { status: 'failed' };
      try { errorPayload.lastError = err && err.message ? err.message : String(err); } catch (_) { errorPayload.lastError = 'unknown'; }
      try { errorPayload.lastErrorStack = err && err.stack ? err.stack : undefined; } catch (_) {}
      await this.multimediaModel.findByIdAndUpdate(multimediaId, errorPayload as any).exec();
      throw err;
    } finally {
      // ensure temp files are cleaned even on unexpected errors
      const candidates = [
        tempIn,
        path.join(tmpDir, `out-${baseName}.mp4`),
        path.join(tmpDir, `opt-${baseName}`),
        path.join(tmpDir, `thumb-${baseName}.jpg`),
      ];
      for (const p of candidates) {
        try { await fsPromises.unlink(p); } catch (_) {}
      }
    }
    
  }
}

export default {};
