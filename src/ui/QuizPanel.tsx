/**
 * Quiz Mode panel (Day 14). Generates a fresh quiz from the CURRENT graph on
 * demand (never on mount, since an empty/small graph would just show "no
 * questions available" before the person has drawn anything). Answering
 * reveals the correct option and the explanation; a running score is kept for
 * the current quiz only (it resets when a new quiz is generated).
 */
import { useState } from 'react'
import type { QuizQuestion } from '../engine/quiz'
import { availableQuestionTypes, generateQuiz } from '../engine/quiz'
import { useGraphStore } from './graphStore'

const QUESTIONS_PER_QUIZ = 5

const TYPE_LABEL: Record<QuizQuestion['type'], string> = {
  'shortest-path': 'Shortest path',
  'bfs-order': 'BFS order',
  'mst-weight': 'MST weight',
}

export default function QuizPanel() {
  const graph = useGraphStore((s) => s.graph)
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const start = () => {
    setQuiz(generateQuiz(graph, QUESTIONS_PER_QUIZ, Math.floor(Math.random() * 2 ** 31)))
    setIndex(0)
    setSelected(null)
    setScore(0)
  }

  const question = quiz?.[index] ?? null
  const answered = selected !== null

  const choose = (i: number) => {
    if (answered) return
    setSelected(i)
    if (question && i === question.correctIndex) setScore((s) => s + 1)
  }

  const next = () => {
    setIndex((i) => i + 1)
    setSelected(null)
  }

  const availableTypes = availableQuestionTypes(graph)

  return (
    <section className="panel quiz">
      <h2>Quiz mode</h2>

      {availableTypes.length === 0 ? (
        <p className="empty">Draw a bigger, weighted, connected graph to unlock quiz questions.</p>
      ) : quiz === null ? (
        <>
          <p className="hint">
            Questions are generated live from real algorithm runs on your current graph — no fixed answer key.
          </p>
          <button onClick={start}>Start quiz</button>
        </>
      ) : quiz.length === 0 ? (
        <p className="empty">Couldn't generate any questions from this graph. Try a larger or more connected one.</p>
      ) : index >= quiz.length ? (
        <>
          <p className="fact">
            Score: {score} / {quiz.length}
          </p>
          <button onClick={start}>New quiz</button>
        </>
      ) : (
        question && (
          <>
            <p className="quiz-progress">
              Question {index + 1} of {quiz.length} — {TYPE_LABEL[question.type]} — Score: {score}
            </p>
            <p className="fact">{question.prompt}</p>
            <ul className="quiz-options" aria-label="Answer options">
              {question.options.map((option, i) => {
                const classes = ['quiz-option']
                if (answered && i === question.correctIndex) classes.push('quiz-correct')
                else if (answered && i === selected) classes.push('quiz-incorrect')
                return (
                  <li key={option}>
                    <button className={classes.join(' ')} onClick={() => choose(i)} disabled={answered}>
                      {option}
                    </button>
                  </li>
                )
              })}
            </ul>
            {answered && (
              <>
                <p className="quiz-explanation">{question.explanation}</p>
                <button onClick={next}>{index + 1 === quiz.length ? 'See score' : 'Next question'}</button>
              </>
            )}
          </>
        )
      )}
    </section>
  )
}
