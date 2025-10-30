import type { Meta, StoryObj } from "@storybook/react"
import { FileUploader } from "./file-uploader"
import { fn, userEvent, within, fireEvent, expect, spyOn, createEvent } from "storybook/test";

const meta = {
  title: "Components/FileUploader",
  component: FileUploader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onFilesSelected: fn(),
  },
} satisfies Meta<typeof FileUploader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InCard: Story = {
  decorators: [
    (Story) => (
      <div className="w-[600px] rounded-lg border border-border bg-card p-6">
        <Story />
      </div>
    ),
  ],
}

const mockPdfFile = new File(["dummy pdf content"], "test1.pdf", {
  type: "application/pdf",
});
const mockTxtFile = new File(["dummy text content"], "test2.txt", {
  type: "text/plain",
});

export const TestButtonRefClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('file-input');

    // input の click メソッドをスパイ（監視）
    const clickSpy = spyOn(input, 'click');

    // ユーザーがボタンをクリック
    await userEvent.click(canvas.getByRole('button', { name: 'ファイルを選択' }));

    // input の click が呼ばれたことを確認
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore(); // スパイを解除
  },
};

export const TestUploadSuccess: Story = { // 👈 名前を変更
  args: {
    onFilesSelected: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('file-input');
    if (!input) throw new Error("File input not found");

    const alertSpy = spyOn(window, 'alert').mockImplementation(() => {});

    // PDF と TXT を渡そうとする
    await userEvent.upload(input as HTMLElement, [mockPdfFile, mockTxtFile]);

    // accept="application/pdf" のため、PDF のみ onFilesSelected に渡される
    await expect(args.onFilesSelected).toHaveBeenCalledWith([mockPdfFile]);
    
    // accept 属性で .txt が弾かれるため、アラートは呼ばれない
    await expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  },
};

export const TestDragAndDropFiltering: Story = { // 👈 名前を変更
  args: {
    onFilesSelected: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dropzone = canvas.getByTestId('dropzone');
    const alertSpy = spyOn(window, 'alert').mockImplementation(() => {});

    // 1. handleDragOver をカバー
    await fireEvent.dragOver(dropzone);

    // 2. handleDrop をカバー（createEvent を使用）
    
    // 'drop' イベントを作成
    const dropEvent = createEvent.drop(dropzone);

    // 作成したイベントに、コンポーネントが読み取る dataTransfer プロパティを手動で追加
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [mockPdfFile, mockTxtFile],
      },
    });

    // dataTransfer がモックされたイベントを発火させる
    await fireEvent(dropzone, dropEvent);

    // 3. handleDrop 内部のロジックで PDF だけが渡される
    await expect(args.onFilesSelected).toHaveBeenCalledWith([mockPdfFile]);
    
    // 4. TXT があったため、アラートが呼ばれる
    await expect(alertSpy).toHaveBeenCalledWith("PDFファイルのみ選択してください");

    alertSpy.mockRestore();
  },
};