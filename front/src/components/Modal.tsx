import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ModalProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
	isOpen: boolean;
	hasCloseBtn?: boolean;
	initialFocusRef?: React.RefObject<HTMLElement | null>;
	onClose?: () => void;
	children: React.ReactNode;
}

export default function Modal({ isOpen, hasCloseBtn, onClose, children, initialFocusRef, ...props }: ModalProps) {
	const modalRef = useRef<HTMLDialogElement>(null);

	const handleCloseModal = () => {
		if (onClose && isOpen) {
			onClose();
		}
	};

	useHotkeys("esc", () => handleCloseModal(), { enableOnFormTags: true });
	useEffect(() => {
		// Grabbing a reference to the modal in question
		const modalElement = modalRef.current;
		if (!modalElement) return;

		// Open modal when `isOpen` changes to true
		if (isOpen) {
			modalElement.showModal();
			initialFocusRef?.current?.focus();
		} else {
			modalElement.close();
		}
	}, [isOpen, initialFocusRef]);

	return (
		<dialog ref={modalRef} {...props} aria-labelledby="dialog-title">
			{hasCloseBtn && (
				<button type="button" className="modal-close-btn" onClick={handleCloseModal} aria-label="Close modal">
					✕
				</button>
			)}
			{children}
		</dialog>
	);
}
