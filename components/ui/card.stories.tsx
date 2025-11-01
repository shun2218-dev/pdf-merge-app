import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "./button";

const meta = {
	title: "UI/Card",
	component: Card,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Card className="w-[350px]">
			<CardHeader>
				<CardTitle>Card Title</CardTitle>
				<CardDescription>Card description goes here</CardDescription>
			</CardHeader>
			<CardContent>
				<p>This is the card content area where you can place any content.</p>
			</CardContent>
			<CardFooter className="flex justify-between">
				<Button variant="outline">Cancel</Button>
				<Button>Submit</Button>
			</CardFooter>
		</Card>
	),
};

export const Simple: Story = {
	render: () => (
		<Card className="w-[350px] p-6">
			<p>A simple card with just content and padding.</p>
		</Card>
	),
};

export const WithoutFooter: Story = {
	render: () => (
		<Card className="w-[350px]">
			<CardHeader>
				<CardTitle>Notification</CardTitle>
				<CardDescription>You have 3 unread messages</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<p className="text-sm">Message 1: Hello there!</p>
					<p className="text-sm">Message 2: How are you?</p>
					<p className="text-sm">Message 3: Let's meet up</p>
				</div>
			</CardContent>
		</Card>
	),
};
