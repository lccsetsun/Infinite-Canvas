import { resolveSingleImageUpload } from "./resolveSingleImageUpload";

type SingleImageUploadInput = {
  files: ArrayLike<File> | null;
  value: string;
};

export function consumeSingleImageUploadSelection(input: SingleImageUploadInput) {
  const file = resolveSingleImageUpload(input.files);
  input.value = "";
  return file;
}
