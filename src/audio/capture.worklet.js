// Audio-thread side of mic capture: a thin wrapper (CLAUDE.md hard rule 1).
// Copies input samples into one preallocated chunk and posts it when full. No allocation,
// logging or object creation here; the only copy is postMessage's own structured clone
// (~47 times per second), which is cheaper and simpler than a transfer/return buffer pool.

class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunk = new Float32Array(options.processorOptions.chunkSize);
    this.pos = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input === undefined || input.length === 0) return true;
    const samples = input[0];
    const chunk = this.chunk;
    for (let i = 0; i < samples.length; i++) {
      chunk[this.pos++] = samples[i];
      if (this.pos === chunk.length) {
        this.port.postMessage(chunk);
        this.pos = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture', CaptureProcessor);
