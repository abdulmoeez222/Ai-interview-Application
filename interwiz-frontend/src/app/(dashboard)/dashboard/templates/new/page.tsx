'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { templatesAPI } from '@/lib/templates-api';

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(10, 'Question must be at least 10 characters'),
  type: z.enum(['BEHAVIORAL', 'TECHNICAL', 'SITUATIONAL']),
  expectedKeyPoints: z.array(z.string()).min(1, 'Add at least one key point'),
  order: z.number(),
});

const templateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  jobTitle: z.string().min(2, 'Job title is required'),
  domain: z.enum(['ENGINEERING', 'SALES', 'MARKETING', 'CUSTOMER_SUPPORT', 'PRODUCT', 'DESIGN', 'DATA_SCIENCE', 'OTHER']),
  questions: z.array(questionSchema).min(1, 'Add at least one question'),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

export default function NewTemplatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentKeyPoint, setCurrentKeyPoint] = useState<{ [key: number]: string }>({});

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      title: '',
      description: '',
      jobTitle: '',
      domain: 'ENGINEERING',
      questions: [
        {
          id: crypto.randomUUID(),
          text: '',
          type: 'BEHAVIORAL',
          expectedKeyPoints: [],
          order: 1,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'questions',
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      // For now, we'll create a simplified template
      // In production, you'd need to create assessments first, then template
      // This is a simplified version - you may need to adjust based on your backend
      return templatesAPI.create({
        title: data.title,
        description: data.description,
        jobTitle: data.jobTitle,
        domain: data.domain,
        assessments: [], // Will be populated when we create assessments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully');
      router.push('/dashboard/templates');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create template';
      toast.error(message);
    },
  });

  const onSubmit = (data: TemplateFormValues) => {
    createMutation.mutate(data);
  };

  const addKeyPoint = (questionIndex: number) => {
    const keyPoint = currentKeyPoint[questionIndex]?.trim();
    if (!keyPoint) return;

    const currentKeyPoints = form.getValues(`questions.${questionIndex}.expectedKeyPoints`);
    form.setValue(`questions.${questionIndex}.expectedKeyPoints`, [
      ...currentKeyPoints,
      keyPoint,
    ]);
    setCurrentKeyPoint({ ...currentKeyPoint, [questionIndex]: '' });
  };

  const removeKeyPoint = (questionIndex: number, keyPointIndex: number) => {
    const currentKeyPoints = form.getValues(`questions.${questionIndex}.expectedKeyPoints`);
    form.setValue(
      `questions.${questionIndex}.expectedKeyPoints`,
      currentKeyPoints.filter((_, i) => i !== keyPointIndex)
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <h1 className="text-3xl font-bold">Create Interview Template</h1>
        <p className="text-muted-foreground mt-1">
          Set up questions and criteria for your interview
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                General details about this interview template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Frontend Developer Screening" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Senior Frontend Developer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select domain" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ENGINEERING">Engineering</SelectItem>
                        <SelectItem value="SALES">Sales</SelectItem>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                        <SelectItem value="CUSTOMER_SUPPORT">Customer Support</SelectItem>
                        <SelectItem value="PRODUCT">Product</SelectItem>
                        <SelectItem value="DESIGN">Design</SelectItem>
                        <SelectItem value="DATA_SCIENCE">Data Science</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the purpose of this interview template..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Questions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Interview Questions</CardTitle>
                  <CardDescription>
                    Add questions that the AI will ask candidates
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      id: crypto.randomUUID(),
                      text: '',
                      type: 'BEHAVIORAL',
                      expectedKeyPoints: [],
                      order: fields.length + 1,
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <Card key={field.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Question {index + 1}
                      </CardTitle>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`questions.${index}.text`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Question Text</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Tell me about a time when you had to solve a complex problem..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`questions.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Question Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select question type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="BEHAVIORAL">Behavioral</SelectItem>
                              <SelectItem value="TECHNICAL">Technical</SelectItem>
                              <SelectItem value="SITUATIONAL">Situational</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>Expected Key Points</FormLabel>
                      <FormDescription>
                        Add key points the AI should look for in the answer
                      </FormDescription>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., Problem-solving approach"
                          value={currentKeyPoint[index] || ''}
                          onChange={(e) =>
                            setCurrentKeyPoint({
                              ...currentKeyPoint,
                              [index]: e.target.value,
                            })
                          }
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addKeyPoint(index);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addKeyPoint(index)}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {form.watch(`questions.${index}.expectedKeyPoints`).map((point, pointIndex) => (
                          <div
                            key={pointIndex}
                            className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
                          >
                            {point}
                            <button
                              type="button"
                              onClick={() => removeKeyPoint(index, pointIndex)}
                              className="hover:text-red-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Template
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

