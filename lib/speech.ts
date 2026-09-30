type LocalTranscriber = (
  audio: Float32Array,
  options: {
    task: 'transcribe'
    language?: string
    chunk_length_s: number
    stride_length_s: number
  },
) => Promise<{ text: string }>

export type SpeechModelName = 'small' | 'tiny'
export type SpeechModelCallbacks = {
  onProgress?: (progress: number) => void
  onFallback?: () => void
}

let transcriberPromise: Promise<LocalTranscriber> | null = null
let loadedModel: SpeechModelName | null = null

function getTranscriber(callbacks: SpeechModelCallbacks = {}) {
  if (!transcriberPromise) {
    const reportProgress = (progress: { status: string; progress?: number }) => {
      if (progress.status === 'progress' && typeof progress.progress === 'number') {
        callbacks.onProgress?.(Math.round(progress.progress))
      }
    }

    transcriberPromise = import('@huggingface/transformers')
      .then(async ({ pipeline }) => {
        const device = typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm'
        const loadModel = (size: SpeechModelName, targetDevice: 'webgpu' | 'wasm') => pipeline(
          'automatic-speech-recognition',
          `onnx-community/whisper-${size}`,
          { dtype: 'q8', device: targetDevice, progress_callback: reportProgress },
        )

        if (device === 'webgpu') {
          try {
            const transcriber = await loadModel('small', 'webgpu')
            loadedModel = 'small'
            return transcriber as unknown as LocalTranscriber
          } catch (webGpuError) {
            console.warn('Whisper Small WebGPU unavailable; retrying with WASM.', webGpuError)
          }
        }

        try {
          const transcriber = await loadModel('small', 'wasm')
          loadedModel = 'small'
          return transcriber as unknown as LocalTranscriber
        } catch (smallModelError) {
          console.warn('Whisper Small unavailable on WASM; falling back to Whisper Tiny.', smallModelError)
          callbacks.onFallback?.()
          const transcriber = await loadModel('tiny', 'wasm')
          loadedModel = 'tiny'
          return transcriber as unknown as LocalTranscriber
        }
      })
      .catch((error: unknown) => {
        transcriberPromise = null
        loadedModel = null
        throw error
      })
  }

  return transcriberPromise
}

export async function prepareSpeechModel(callbacks: SpeechModelCallbacks = {}) {
  await getTranscriber(callbacks)
  return loadedModel ?? 'small'
}

export async function transcribeAudio(audio: Float32Array, language?: string) {
  const transcriber = await getTranscriber()
  const output = await transcriber(audio, {
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(language ? { language } : {}),
  })

  return output.text.trim()
}