declare module 'pptx2json' {
  class PPTX2Json {
    buffer2json(buffer: Buffer): Promise<unknown>;
  }
  export default PPTX2Json;
}
