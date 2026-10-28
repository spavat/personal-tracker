namespace Money {
	interface PaymentType {
		id: number;
		name: string;
		icon: string;
		backgroundColor: string;
		textColor: string;
	}

	interface PaymentTypeWithDetails extends PaymentType {
		transactions: Array<Transaction>;
	}

	interface Account {
		id: number;
		name: string;
		icon: string;
		backgroundColor: string;
		textColor: string;
		paymentTypes: Array<PaymentType>;
	}

	interface Bank {
		id: number;
		name: string;
		accounts: Array<Account>;
	}

	interface Category {
		id: number;
		name: string;
		icon: string;
		backgroundColor: string;
		textColor: string;
		parentId: number | null;
	}

	interface YearTag {
		year: string;
		amount: number;
		nbTransactions: number;
	}
	interface Tag {
		id: number;
		name: string;
		icon: string;
		backgroundColor: string;
		textColor: string;
		parentId: number | null;
	}

	interface TagWithTransactions extends Tag {
		transactions: Array<Transaction>;
		years: Array<YearTag>;
	}

	interface AnalyticPart {
		name: string;
		amount: number;
		comment: string;
	}
	interface AnalyticBadge extends Pick<Tag, "name" | "icon" | "textColor" | "backgroundColor"> {
		amount: number;
		comment: string;
		parts: Array<AnalyticPart>;
	}

	interface Analytic {
		name: string;
		badges: Array<AnalyticBadge>;
	}

	interface Analytics {
		name: string;
		tags: Array<TagWithTransactions>;
	}

	interface Transaction {
		id: number;
		name: string;
		description: string;
		comment?: string;
		date: string;
		considerationDate?: string;
		amount: number;
		tags: Array<any>;
		children: Array<Transaction>;
		informative: boolean;
		category: any;
		paymentType: any;
		categoryId: number;
		paymentTypeId: number;
		[string]: any;
		tags: Array<Tag>;
		recurrent: boolean;
	}

	interface AmountHistory {
		id: number;
		date: string;
		amount: number;
	}

	interface AccountDetails extends Account {
		history: Array<AmountHistory>;
	}

	interface AccounWithHistory extends Account {
		history: Array<AmountHistory>;
	}

	interface BankWithHistory {
		id: number;
		name: string;
		accounts: Array<AccounWithHistory>;
	}
}
