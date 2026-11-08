export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const share = { files: [file], title: file.name }
  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare(share)) {
      await navigator.share(share)
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
