import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Code, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import axios from 'axios';
import { utils_service } from '@/context/AppContext';
import { toast } from 'react-hot-toast';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
            }),
            Image,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[150px] p-4 border rounded-md',
            },
        },
    });

    if (!editor) {
        return null;
    }

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const base64data = reader.result;
                const { data } = await axios.post(`${utils_service}/api/utils/upload`, {
                    buffer: base64data,
                });
                editor.chain().focus().setImage({ src: (data as any).url }).run();
                setUploading(false);
            };
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload image");
            setUploading(false);
        }
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 border-b pb-2 mb-2">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`p-1 rounded ${editor.isActive('bold') ? 'bg-muted' : ''}`}
                >
                    <Bold size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`p-1 rounded ${editor.isActive('italic') ? 'bg-muted' : ''}`}
                >
                    <Italic size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1 rounded ${editor.isActive('bulletList') ? 'bg-muted' : ''}`}
                >
                    <List size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1 rounded ${editor.isActive('orderedList') ? 'bg-muted' : ''}`}
                >
                    <ListOrdered size={18} />
                </button>
                <button type="button" onClick={setLink} className={`p-1 rounded ${editor.isActive('link') ? 'bg-muted' : ''}`}>
                    <LinkIcon size={18} />
                </button>
                <button type="button" onClick={triggerImageUpload} className="p-1 rounded" disabled={uploading}>
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`p-1 rounded ${editor.isActive('codeBlock') ? 'bg-muted' : ''}`}
                >
                    <Code size={18} />
                </button>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                />
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
