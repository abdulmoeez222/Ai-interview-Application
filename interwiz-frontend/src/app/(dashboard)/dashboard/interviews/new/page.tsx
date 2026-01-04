'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Copy, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { interviewsAPI } from '@/lib/interviews-api';
import { templatesAPI } from '@/lib/templates-api';

const interviewSchema = z.object({
  candidateName: z.string().min(2, 'Name must be at least 2 characters'),
  candidateEmail: z.string().email('Invalid email address'),
  templateId: z.string().min(1, 'Please select a template'),
});

type InterviewFormValues = z.infer<typeof interviewSchema>;

export default function NewInterviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createdInterview, setCreatedInterview] = useState<any>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      candidateName: '',
      candidateEmail: '',
      templateId: '',
    },
  });

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesAPI.getAll,
  });

  const createMutation = useMutation({
    mutationFn: interviewsAPI.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      setCreatedInterview(data);
      toast.success('Interview created successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create interview';
      toast.error(message);
    },
  });

  const onSubmit = (data: InterviewFormValues) => {
    createMutation.mutate(data);
  };

  const copyLink = () => {
    if (createdInterview) {
      const link = `${window.location.origin}/interview/${createdInterview.joinToken}`;
      navigator.clipboard.writeText(link);
      setLinkCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Calculate total questions from assessments
  const getTotalQuestions = (template: any) => {
    return template.assessments?.reduce((total: number, ta: any) => {
      const questions = (ta.assessment?.questions as any[]) || [];
      return total + questions.length;
    }, 0) || 0;
  };

  if (createdInterview) {
    const interviewLink = `${window.location.origin}/interview/${createdInterview.joinToken}`;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Interview Created!</h1>
          <p className="text-muted-foreground mt-1">
            Share this link with the candidate
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <CheckCircle className="mr-2 h-5 w-5" />
              Interview Ready
            </CardTitle>
            <CardDescription>
              The interview has been created for {createdInterview.candidateName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Interview Link
              </label>
              <div className="flex gap-2">
                <Input
                  value={interviewLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={copyLink} variant="outline">
                  {linkCopied ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                Send this link to <strong>{createdInterview.candidateEmail}</strong> to begin the interview.
                The link is unique and can only be used once.
              </AlertDescription>
            </Alert>

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/interviews')}
                className="flex-1"
              >
                View All Interviews
              </Button>
              <Button
                onClick={() => {
                  setCreatedInterview(null);
                  form.reset();
                }}
                className="flex-1"
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Create Interview</h1>
        <p className="text-muted-foreground mt-1">
          Send an AI interview to a candidate
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interview Details</CardTitle>
          <CardDescription>
            Enter the candidate's information and select a template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="candidateName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="candidateEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="candidate@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The interview link will be generated for this candidate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interview Template</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templatesLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading templates...
                          </SelectItem>
                        ) : templates && templates.length > 0 ? (
                          templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.title} ({getTotalQuestions(template)} questions)
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No templates available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose which interview questions to ask
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !templates?.length}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Interview
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {!templates?.length && !templatesLoading && (
        <Alert>
          <AlertDescription>
            You need to create at least one template before creating an interview.{' '}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => router.push('/dashboard/templates/new')}
            >
              Create a template now
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

